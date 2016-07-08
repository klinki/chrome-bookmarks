import { Injectable } from '@angular/core';
import { BookmarksProviderService } from './bookmarks-provider.service';

@Injectable()
export class MockBookmarksProviderService extends BookmarksProviderService {

  constructor() {
    super();
  }

  public getBookmarks(): Promise<chrome.bookmarks.BookmarkTreeNode> {
    return new Promise(function(resolve, reject) {
        let data = [
          {
            title: "Root directory",
            children: [
              {
                url: "http://seznam.cz",
                title: "Seznam - najdu tam co neznám"
              },
              {
                url: "http://google.cz",
                title: "Google - search"
              },
              {
                title: "2nd level dir",
                children: [
                  {
                    url: "http://alza.cz",
                    title: "Alza.cz green alien"
                  }
                ]
              }
            ]
          },
        ];

        return resolve(data);
    });
  }
}
