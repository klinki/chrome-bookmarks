import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MockBookmarksService } from './mock-bookmarks.service';

describe('MockBookmarksService Chrome contracts', () => {
  let service: MockBookmarksService;

  beforeEach(() => {
    Object.defineProperty(globalThis, 'chrome', {
      configurable: true,
      value: { bookmarks: undefined },
      writable: true
    });
    service = new MockBookmarksService();
  });

  it('creates folders at the requested index and emits the created node', async () => {
    const created = vi.fn();
    service.onCreatedEvent$.subscribe(created);

    const folder = await service.create({ parentId: '1', index: 0, title: 'Created folder' });
    const children = await service.getChildren('1');

    expect(folder).toMatchObject({
      title: 'Created folder',
      parentId: '1',
      index: 0,
      children: []
    });
    expect(children[0].id).toBe(folder.id);
    expect(children.map(child => child.index)).toEqual(children.map((_, index) => index));
    expect(created).toHaveBeenCalledWith([folder.id, folder]);
  });

  it('creates bookmarks in Other Bookmarks by default', async () => {
    const bookmark = await service.create({ title: 'Default parent', url: 'https://example.com' });

    expect(bookmark).toMatchObject({ parentId: '2', title: 'Default parent', url: 'https://example.com' });
    expect(bookmark.children).toBeUndefined();
    await expect(service.get(bookmark.id)).resolves.toEqual([bookmark]);
  });

  it('returns only the requested number of newest bookmarks', async () => {
    const first = await service.create({ parentId: '1', title: 'First', url: 'https://example.com/first' });
    const folder = await service.create({ parentId: '1', title: 'Recent folder' });
    const second = await service.create({ parentId: '1', title: 'Second', url: 'https://example.com/second' });

    const recent = await service.getRecent(2);

    expect(recent.map(node => node.id)).toEqual([second.id, first.id]);
    expect(recent.map(node => node.id)).not.toContain(folder.id);
  });

  it('requires every supplied object search field to match', async () => {
    const alpha = await service.create({
      parentId: '1',
      title: 'Alpha docs',
      url: 'https://example.com/docs'
    });
    await service.create({
      parentId: '1',
      title: 'Alpha other',
      url: 'https://other.test/home'
    });

    await expect(service.search({ title: 'Alpha', url: 'example.com' }))
      .resolves.toEqual([alpha]);
    await expect(service.search({ title: 'Alpha', url: 'missing.test' }))
      .resolves.toEqual([]);
    await expect(service.search({ query: 'docs' }))
      .resolves.toEqual([alpha]);
  });

  it('moves bookmarks to the requested parent and index and reindexes siblings', async () => {
    const movedEvent = vi.fn();
    service.onMovedEvent$.subscribe(movedEvent);
    const first = await service.create({ parentId: '1', title: 'First move', url: 'https://example.com/1' });
    const second = await service.create({ parentId: '1', title: 'Second move', url: 'https://example.com/2' });
    const destination = await service.create({ parentId: '2', title: 'Destination' });
    const existing = await service.create({ parentId: destination.id, title: 'Existing', url: 'https://example.com/e' });

    const moved = await service.move(second.id, { parentId: destination.id, index: 0 });
    const sourceChildren = await service.getChildren('1');
    const destinationChildren = await service.getChildren(destination.id);

    expect(moved).toMatchObject({ parentId: destination.id, index: 0 });
    expect(sourceChildren.find(node => node.id === first.id)?.index).toBe(sourceChildren.length - 1);
    expect(sourceChildren.some(node => node.id === second.id)).toBe(false);
    expect(destinationChildren.map(node => node.id)).toEqual([second.id, existing.id]);
    expect(destinationChildren.map(node => node.index)).toEqual([0, 1]);
    expect(movedEvent).toHaveBeenCalledWith([
      second.id,
      {
        oldIndex: expect.any(Number),
        index: 0,
        oldParentId: '1',
        parentId: destination.id
      }
    ]);
  });

  it('updates only supplied fields and emits complete change information', async () => {
    const changed = vi.fn();
    service.onChangedEvent$.subscribe(changed);
    const bookmark = await service.create({
      parentId: '1',
      title: 'Before',
      url: 'https://example.com/before'
    });

    const updated = await service.update(bookmark.id, { title: 'After' });

    expect(updated).toMatchObject({ title: 'After', url: 'https://example.com/before' });
    expect(changed).toHaveBeenCalledWith([
      bookmark.id,
      { title: 'After' }
    ]);
  });

  it('removes leaves, reindexes siblings, and emits Chrome removal details', async () => {
    const removed = vi.fn();
    service.onRemovedEvent$.subscribe(removed);
    const folder = await service.create({ parentId: '2', title: 'Removal folder' });
    const first = await service.create({ parentId: folder.id, title: 'First', url: 'https://example.com/1' });
    const second = await service.create({ parentId: folder.id, title: 'Second', url: 'https://example.com/2' });

    await service.remove(first.id);

    await expect(service.get(first.id)).rejects.toThrow(`Invalid bookmark id: ${first.id}`);
    await expect(service.getChildren(folder.id)).resolves.toMatchObject([{ id: second.id, index: 0 }]);
    expect(removed).toHaveBeenCalledWith([
      first.id,
      {
        parentId: folder.id,
        index: 0,
        node: first
      }
    ]);
  });

  it('rejects non-recursive removal of non-empty folders', async () => {
    const folder = await service.create({ parentId: '2', title: 'Non-empty' });
    await service.create({ parentId: folder.id, title: 'Child', url: 'https://example.com' });

    await expect(service.remove(folder.id)).rejects.toThrow('Cannot remove a non-empty folder');
    await expect(service.get(folder.id)).resolves.toHaveLength(1);
  });

  it('recursively removes descendants with removeTree', async () => {
    const folder = await service.create({ parentId: '2', title: 'Tree' });
    const childFolder = await service.create({ parentId: folder.id, title: 'Child folder' });
    const descendant = await service.create({
      parentId: childFolder.id,
      title: 'Descendant',
      url: 'https://example.com/descendant'
    });

    await service.removeTree(folder.id);

    await expect(service.get(folder.id)).rejects.toThrow(`Invalid bookmark id: ${folder.id}`);
    await expect(service.get(childFolder.id)).rejects.toThrow(`Invalid bookmark id: ${childFolder.id}`);
    await expect(service.get(descendant.id)).rejects.toThrow(`Invalid bookmark id: ${descendant.id}`);
  });

  it('rejects invalid operations without partially mutating the tree', async () => {
    await expect(service.create({ parentId: '1', index: 10_000, title: 'Invalid' }))
      .rejects.toThrow('Invalid bookmark index');

    const bookmark = await service.create({
      parentId: '1',
      title: 'Stable bookmark',
      url: 'https://example.com/stable'
    });
    const childrenBeforeMove = await service.getChildren('1');

    await expect(service.move(bookmark.id, { parentId: '2', index: 10_000 }))
      .rejects.toThrow('Invalid bookmark index');
    await expect(service.getChildren('1')).resolves.toEqual(childrenBeforeMove);

    const parent = await service.create({ parentId: '1', title: 'Parent folder' });
    const child = await service.create({ parentId: parent.id, title: 'Child folder' });

    await expect(service.move(parent.id, { parentId: child.id }))
      .rejects.toThrow('A folder cannot be moved into itself or a descendant');
  });

  it('returns detached snapshots rather than mutable internal nodes', async () => {
    const firstTree = await service.getTree();
    firstTree[0].title = 'Mutated externally';
    firstTree[0].children!.splice(0);

    const secondTree = await service.getTree();

    expect(secondTree[0].title).toBe('root');
    expect(secondTree[0].children).toHaveLength(2);
  });
});
