export class AppPage {
  constructor(public page: any) {}

  async navigate() {
    await this.page.goto('/');
  }

  async getParagraphText() {
    // Example method to retrieve text from the main heading
    return await this.page.textContent('app-root h1');
  }
}
