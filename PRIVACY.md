# Good Enough Bookmark Manager — Privacy Policy

Effective date: 15 October 2026

Publisher: **Klinki**  
Contact: **info@advatab.net**  
Support: <https://github.com/klinki/chrome-bookmarks/issues>

Good Enough Bookmark Manager helps you find, organize, and clean up the bookmarks in your Chrome profile. This policy describes the installed Chrome extension. GitHub and any AI service you choose have their own privacy policies.

## Bookmark management on your device

The extension accesses bookmark titles, URLs, folders, and the dates Chrome makes available. It uses this information to display, search, sort, edit, move, import, export, and clean up bookmarks.

Your bookmarks remain in Chrome's bookmark system. Tags, usefulness ratings, saved searches, cleanup records, AI job checkpoints, organization plans, cached embeddings, and preferences are stored on your device using Chrome extension storage, local storage, and IndexedDB. Search indexes are processed locally. Chrome may synchronize the bookmarks themselves according to your browser settings; the extension does not operate a synchronization server.

The publisher does not receive your bookmark library, searches, tags, or usage telemetry. The extension contains no advertising or analytics service. Fonts and executable code are included in the extension package. The installed extension requests bookmark icons through Chrome's favicon API; Chrome's own icon retrieval and browser services are governed by Chrome's settings and privacy policy.

Opening a bookmark navigates to that website using your browser. Importing and exporting are actions you initiate; exported files are saved to your chosen download location and remain under your control.

## Optional AI features

AI features are optional. Ordinary bookmark management works without an AI account or connection. Before bookmark data can be sent to an AI server, you must save a server configuration, acknowledge the in-product data-sharing disclosure, enable that connection, and grant Chrome access to that server when requested. AI processing starts when you run an AI action.

Depending on the action and scope you select, the extension sends bookmark identifiers, titles, URLs, tags, folder paths, and usefulness ratings to the configured AI server. Tag-suggestion requests also include your available tag pool so the server can reuse existing labels. Bulk actions can include all eligible bookmarks in their selected scope. Embedding requests use bookmark metadata; organization labeling sends representative bookmark metadata. The extension does not fetch the contents of bookmarked pages for these actions.

The extension supports HTTP connections to local servers on `localhost` or `127.0.0.1`, including Ollama and LM Studio. These requests are directed to your own device. Remote AI endpoints must use HTTPS. If you choose a remote provider, that provider receives the selected metadata and normal connection information, such as your IP address. Its processing, retention, and any subsequent use are governed by that provider's terms and privacy policy. Choose a provider and configuration appropriate for your data; local server software may itself have separate network behavior.

If you supply an API key, it is saved in Chrome's local extension storage and included as an authentication header only in requests to your configured AI endpoint. This storage is not an encrypted password vault. The publisher does not receive your key. API keys are not included in bookmark exports.

The **Disconnect AI** control revokes the extension's access to that server, removes the saved API key, and blocks subsequent AI requests until you enable a connection again. You can also remove site access in Chrome's extension settings. Disconnecting does not delete information a provider has already received; contact that provider about its retention and deletion procedures.

## Data use and sharing

Data is used to provide bookmark management and the optional AI actions described above. We do not sell user data, use it for advertising, or use or transfer it to determine creditworthiness or for lending purposes. We do not operate a backend that receives or stores your bookmark data. Transfers to an AI service occur only for the user-facing AI functionality you enable.

Our use of information obtained through Google APIs complies with the Chrome Web Store User Data Policy, including its Limited Use requirements.

## Retention and your controls

You control your bookmarks through the extension and Chrome's bookmark tools. Removing an extension-specific tag, rating, saved search, or saved operation updates its local records. Cleanup and organization features can retain local recovery records and backups so that changes can be reviewed or undone.

Uninstalling the extension removes its extension-managed local storage through Chrome. It does not remove your Chrome bookmarks, undo changes already made to them, delete exported files from your disk, or delete data retained by an AI provider. You can delete downloaded backups yourself and manage Chrome's own synchronization separately.

## Support and policy updates

If you contact us by email or GitHub, we receive the information you choose to send and use it to answer your request. GitHub issues are public: avoid posting API keys, private bookmark exports, or other sensitive information. GitHub and email providers process support communications under their own policies.

This policy may be updated when the extension's behavior changes. The effective date above identifies the current version. Questions about this policy can be sent to **info@advatab.net**.
