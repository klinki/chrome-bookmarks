import { expect, test } from '@playwright/test';
import { getMockData, setupChromeMock } from './e2e-utils';

test('generates, reviews, applies, and undoes an organization plan without a live LLM', async ({ page }) => {
  const { root, MOCK_BOOKMARKS_MAP } = getMockData();
  await setupChromeMock(page, root, MOCK_BOOKMARKS_MAP);
  await page.route('**/embeddings', async route => {
    const body = route.request().postDataJSON();
    const input = body.input as string[];
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      data: input.map((_value, index) => ({ index, embedding: [index % 2, (index + 1) % 2, 1] }))
    }) });
  });
  await page.route('**/chat/completions', async route => {
    const body = route.request().postDataJSON();
    const clusters = JSON.parse(body.messages[1].content) as Array<{ id: string }>;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: {
      content: JSON.stringify({ results: clusters.map((cluster, index) => ({
        id: cluster.id, folderPath: [`Topic ${index + 1}`], topicTags: [`topic-${index + 1}`],
        confidence: 0.8, rationale: 'Mocked deterministic label'
      })) })
    } }] }) });
  });

  await page.goto('/#/organize');
  await page.getByLabel('Destination root').selectOption('1');
  await page.getByLabel('Topics (0 = automatic)').fill('2');
  await page.getByRole('button', { name: 'Generate plan' }).click();

  await expect(page.getByText('Nothing is selected by default.')).toBeVisible();
  const proposals = page.locator('.proposal');
  await expect(proposals).not.toHaveCount(0);
  await expect(proposals.first().locator('input[type="checkbox"]').first()).not.toBeChecked();
  await proposals.first().locator('input[type="checkbox"]').first().check();

  page.once('dialog', dialog => dialog.accept());
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Apply selected changes' }).click();
  await download;
  await expect(page.getByRole('status')).toContainText('applied');

  await page.getByRole('button', { name: 'Undo last apply' }).click();
  await expect(page.getByRole('status')).toContainText('Undo restored');
});
