import { Injectable, inject } from '@angular/core';
import { BookmarksProviderService } from './bookmarks-provider.service';
import { TagsService, BookmarkTags } from './tags.service';

export interface BackupData {
  version: number;
  root: chrome.bookmarks.BookmarkTreeNode[];
  tags: BookmarkTags;
}

@Injectable({
  providedIn: 'root'
})
export class ImportExportService {
  private bookmarksProvider = inject(BookmarksProviderService);
  private tagsService = inject(TagsService);

  constructor() { }

  public async exportJson() {
    const tree = await this.bookmarksProvider.getBookmarks();
    const tags = this.tagsService.bookmarkTags();

    const data: BackupData = {
      version: 1,
      root: tree,
      tags: tags
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    this.downloadFile(blob, `bookmarks_backup_${new Date().toISOString().split('T')[0]}.json`);
  }

  public async importJson(file: File): Promise<void> {
    const text = await file.text();
    const data: BackupData = JSON.parse(text);

    if (!data.root || !Array.isArray(data.root)) {
      throw new Error('Invalid backup file format');
    }

    // Create a root folder for import
    // '1' is typically Bookmarks Bar.
    const importFolder = await this.bookmarksProvider.create({
      parentId: '1',
      title: `Imported ${new Date().toLocaleString()}`
    });

    const idMap = new Map<string, string>();

    // data.root is [rootNode]. We want the children of rootNode (Bar, Other, etc)
    const nodesToImport = data.root[0]?.children || data.root;

    for (const node of nodesToImport) {
        await this.recursiveImport(node, importFolder.id, idMap);
    }

    // Restore tags
    if (data.tags) {
        for (const [oldId, tags] of Object.entries(data.tags)) {
            const newId = idMap.get(oldId);
            if (newId) {
                this.tagsService.setTagsForBookmark(newId, tags);
                tags.forEach(tag => this.tagsService.addAvailableTag(tag));
            }
        }
    }
  }

  private async recursiveImport(node: chrome.bookmarks.BookmarkTreeNode, parentId: string, idMap: Map<string, string>) {
    const created = await this.bookmarksProvider.create({
        parentId: parentId,
        title: node.title,
        url: node.url
    });

    idMap.set(node.id, created.id);

    if (node.children) {
        for (const child of node.children) {
            await this.recursiveImport(child, created.id, idMap);
        }
    }
  }

  private downloadFile(blob: Blob, filename: string) {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }

  public async exportHtml() {
    const tree = await this.bookmarksProvider.getBookmarks();
    // tree is [root]. root children are Bar, Other.

    let html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<!-- This is an automatically generated file.
     It will be read and overwritten.
     DO NOT EDIT! -->
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
`;

    const nodesToExport = tree[0]?.children || tree;
    for (const node of nodesToExport) {
        html += this.nodeToHtml(node, 1);
    }

    html += `</DL><p>`;

    const blob = new Blob([html], { type: 'text/html' });
    this.downloadFile(blob, `bookmarks_${new Date().toISOString().split('T')[0]}.html`);
  }

  private nodeToHtml(node: chrome.bookmarks.BookmarkTreeNode, indentLevel: number): string {
      const indent = '    '.repeat(indentLevel);
      let html = '';

      if (node.url) {
          const tags = this.tagsService.getTagsForBookmark(node.id);
          const escapedTags = tags.map(t => this.escapeHtml(t)).join(',');
          const tagsAttr = tags.length > 0 ? ` TAGS="${escapedTags}"` : '';
          const addDate = node.dateAdded ? ` ADD_DATE="${Math.floor(node.dateAdded / 1000)}"` : '';

          html += `${indent}<DT><A HREF="${this.escapeHtml(node.url)}"${addDate}${tagsAttr}>${this.escapeHtml(node.title)}</A>\n`;
      } else {
          // Folder
          const addDate = node.dateAdded ? ` ADD_DATE="${Math.floor(node.dateAdded / 1000)}"` : '';
          const lastMod = node.dateGroupModified ? ` LAST_MODIFIED="${Math.floor(node.dateGroupModified / 1000)}"` : '';

          html += `${indent}<DT><H3${addDate}${lastMod}>${this.escapeHtml(node.title)}</H3>\n`;
          html += `${indent}<DL><p>\n`;
          if (node.children) {
              for (const child of node.children) {
                  html += this.nodeToHtml(child, indentLevel + 1);
              }
          }
          html += `${indent}</DL><p>\n`;
      }
      return html;
  }

  private escapeHtml(text: string): string {
      return text
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#039;");
  }

  public async importHtml(file: File): Promise<void> {
      const text = await file.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, 'text/html');

      const importFolder = await this.bookmarksProvider.create({
          parentId: '1',
          title: `Imported HTML ${new Date().toLocaleString()}`
      });

      const dl = doc.querySelector('dl');
      if (dl) {
          await this.recursiveHtmlImport(dl, importFolder.id);
      }
  }

  private async recursiveHtmlImport(dl: Element, parentId: string) {
      const children = Array.from(dl.children);

      for (let i = 0; i < children.length; i++) {
          const node = children[i];

          if (node.tagName === 'DT') {
              const h3 = node.querySelector('h3');
              const a = node.querySelector('a');

              if (h3) {
                  const title = h3.textContent || 'Untitled';
                  const folder = await this.bookmarksProvider.create({
                      parentId: parentId,
                      title: title
                  });

                  // Look for internal DL first
                  let internalDl = node.querySelector('dl');
                  if (internalDl) {
                      await this.recursiveHtmlImport(internalDl, folder.id);
                  } else {
                      // Look ahead for DL in siblings
                      let nextIndex = i + 1;
                      while (nextIndex < children.length) {
                          const next = children[nextIndex];
                          if (next.tagName === 'DL') {
                              await this.recursiveHtmlImport(next, folder.id);
                              i = nextIndex;
                              break;
                          } else if (next.tagName === 'DT') {
                              break;
                          }
                          nextIndex++;
                      }
                  }
              } else if (a) {
                   const title = a.textContent || 'Untitled';
                   const url = a.getAttribute('href');
                   const tagsAttr = a.getAttribute('TAGS');

                   if (url) {
                      const bookmark = await this.bookmarksProvider.create({
                          parentId: parentId,
                          title: title,
                          url: url
                      });

                      if (tagsAttr) {
                          const tags = tagsAttr.split(',').map(t => t.trim()).filter(t => t);
                          if (tags.length > 0) {
                              this.tagsService.setTagsForBookmark(bookmark.id, tags);
                              tags.forEach(tag => this.tagsService.addAvailableTag(tag));
                          }
                      }
                   }
              }
          }
      }
  }
}
