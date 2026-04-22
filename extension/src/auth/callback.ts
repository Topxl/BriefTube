// The hash-fragment handoff. launchWebAuthFlow intercepts this page via its
// URL and hands the whole URL (including hash) back to the background worker,
// which parses the tokens. This script is only a safety net if somehow the
// page is opened directly in a normal tab.
window.close();
