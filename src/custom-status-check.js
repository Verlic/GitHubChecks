var GitHubApi = require('github@0.2.4'),
  Promise = require('promise@7.0.1'),
  enforceLabels = ['feature', 'bug fixing', 'product refactor', 'code refactor'],
  github = new GitHubApi({
    // required
    version: "3.0.0",
    // optional
    debug: false,
    protocol: "https",
    host: "api.github.com",
    pathPrefix: "",
    timeout: 5000,
    headers: {
      "user-agent": "auth0-pr-checker"
    }
  }),
  createStatus = Promise.denodeify(github.statuses.create),
  getIssueLabels = Promise.denodeify(github.issues.getIssueLabels);

module.exports = function(context, callback) {
  var token = context.data.GITHUB_API_TOKEN,
    defaultLabel = context.data.default,
    preventLabel = context.data.prevent,
    payload = context.data;

  if (!token) {
    callback('Invalid token. Please verify that the secret is correctly configured.');
    return;
  }

  if (!payload) {
    callback('Invalid payload. Please check your WebHook configuration in GitHub.');
    return;
  }

  // Authenticate with GitHub
  github.authenticate({
    type: 'oauth',
    token: token
  });

  var action = payload.action;
  console.log('New Action received:' + action);

  // We only want to check the PR status when opened, labeled or unlabeled.
  if (action === 'opened' || action === 'labeled' || action === 'unlabeled') {
    checkLabelStatus(payload, preventLabel, callback);
  } else {
    // Ignore action
    callback();
  }
};

/** HELPER FUNCTIONS **/
function checkLabelStatus(payload, preventLabel, callback) {
  status = {
    user: payload.repository.owner.login,
    repo: payload.repository.name,
    sha: payload.pull_request.head.sha,
    context: 'auth0/labels'
  };

  // Get the existing labels for the PR
  getIssueLabels({
    number: payload.pull_request.number,
    user: status.user,
    repo: status.repo
  }).then(function(data) {
    // Check if there are labels and if they are valid
    if (data.length === 0) {
      console.log('No labels found for this PR #' + payload.pull_request.number);
      status.state = 'error';
      status.description = 'This PR is not labeled.';
    } else {
      console.log('Validating PR labels...');
      var labels = data.map(function(item) {
          return item.name.trim().toLowerCase();
        }),
        preventMerge = !preventLabel ? false : labels.indexOf(preventLabel) !== -1,
        hasValidLabels = data.filter(function(label) {
          return enforceLabels.indexOf(label.name.trim().toLowerCase()) !== -1;
        }).length > 0;

      if (preventMerge) {
        console.log('Prevent label found. Force check failure.');
        status.state = 'failure';
        status.description = 'PR labeled as `do not merge` (' + preventLabel + ')';
      } else if (hasValidLabels) {
        console.log('PR labels check passed.');
        status.state = 'success';
        status.description = 'Labels check passed.';
      } else {
        console.log('Required labels not found.');
        status.state = 'failure';
        status.description = 'Missing label. Use "bug fixing", "feature", "product refactor" or "code refactor"';
      }
    }

    createStatus(status)
      .then(function(data) {
        callback(null, 'Completed!');
      })
      .catch(function(err) {
        callback(err);
      });
  });
}
