import { test, expect } from '@playwright/test';
import { getMockData, setupChromeMock } from './e2e-utils';

test.describe('Import & Export', () => {
  let mockData: ReturnType<typeof getMockData>;

  test.beforeEach(async ({ page }) => {
    mockData = getMockData();
    await setupChromeMock(page, mockData.root, mockData.MOCK_BOOKMARKS_MAP);
    await page.goto('/#/settings/import-export');
  });

  test('should navigate to import-export page', async ({ page }) => {
    await expect(page.locator('.settings-container h2')).toContainText('Import & Export');
    await expect(page.getByText('Backup & Restore (JSON)')).toBeVisible();
    await expect(page.getByText('Standard HTML Format')).toBeVisible();
  });

  test('should export JSON', async ({ page }) => {
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export JSON' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('bookmarks_backup_');
    expect(download.suggestedFilename()).toContain('.json');
  });

  test('should export HTML', async ({ page }) => {
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export HTML' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('bookmarks_');
    expect(download.suggestedFilename()).toContain('.html');
  });

  test('should import JSON', async ({ page }) => {
    // Create a mock JSON file content
    const backupData = {
        version: 1,
        root: [
            {
                id: '0',
                children: [
                    {
                        id: '1', // Bar
                        children: [
                            {
                                id: '1001',
                                title: 'Imported JSON Bookmark',
                                url: 'https://json.example.com'
                            }
                        ]
                    }
                ]
            }
        ],
        tags: {}
    };

    // Trigger file chooser and set file
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Import JSON' }).click();
    const fileChooser = await fileChooserPromise;

    await fileChooser.setFiles({
        name: 'backup.json',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify(backupData))
    });

    // Check success message
    await expect(page.getByText('JSON Import successful')).toBeVisible();

    // Verify it called create (indirectly via chrome mock check?)
    // Actually, we can check if we can search for it?
    // Or navigate to bookmarks view and check?
    // The mock is in-memory in the page context.
    // If I search in the app, I should find it.

    // Let's go to main page and search
    await page.getByRole('link', { name: '← Back to Bookmarks' }).click();

    const searchBox = page.getByPlaceholder('Search in bookmarks');
    await searchBox.fill('Imported JSON Bookmark');
    await expect(page.getByText('Imported JSON Bookmark')).toBeVisible();
  });

  test('should import HTML', async ({ page }) => {
    const htmlContent = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
    <DL>
        <DT><A HREF="https://html.example.com">Imported HTML Bookmark</A>
    </DL>`;

    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Import HTML' }).click();
    const fileChooser = await fileChooserPromise;

    await fileChooser.setFiles({
        name: 'bookmarks.html',
        mimeType: 'text/html',
        buffer: Buffer.from(htmlContent)
    });

    await expect(page.getByText('HTML Import successful')).toBeVisible();

    await page.getByRole('link', { name: '← Back to Bookmarks' }).click();

    const searchBox = page.getByPlaceholder('Search in bookmarks');
    await searchBox.fill('Imported HTML Bookmark');
    await expect(page.getByText('Imported HTML Bookmark')).toBeVisible();
  });
});
