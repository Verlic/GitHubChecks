var GitHubApi = require('github@0.2.4'),
  Promise = require('promise@7.0.1'),
  checkLabels = {
    enforceLabels: ['feature', 'bug fixing', 'product refactor', 'code refactor'],
    overrideLabel: 'critical'
  },
  github = new GitHubApi({
    // required
    version: "3.0.0",
    // optional
    debug: true,
    protocol: "https",
    host: "api.github.com",
    pathPrefix: "",
    timeout: 5000,
    headers: {
      "user-agent": "auth0-pr-checker"
    }
  }),
  createStatus = Promise.denodeify(github.statuses.create),
  getIssueLabels = Promise.denodeify(github.issues.getIssueLabels),
  editIssue = Promise.denodeify(github.issues.edit);

module.exports = function(context, callback) {
  var token = context.data.GITHUB_API_TOKEN,
    enforceLabels = context.data.enforce,
    preventLabel = context.data.prevent,
    defaultLabel = context.data.default,
    overrideLabel = context.data.override,
    payload = context.data;

  if (context.data.prevent) {
    checkLabels.preventLabel = preventLabel.toLowerCase();
  }

  if (context.data.default) {
    checkLabels.defaultLabel = defaultLabel.toLowerCase();
  }

  if (context.data.override) {
    checkLabels.overrideLabel = overrideLabel.toLowerCase();
  }

  if (!token) {
    return callback('Invalid token. Please verify that the secret is correctly configured.');
  }

  if (!payload) {
    return callback('Invalid payload. Please check your WebHook configuration in GitHub.');
  }

  if (!payload.pull_request) {
    // Ignore action
    return callback();
  }

  if (enforceLabels) {
    enforceLabels = enforceLabels.toLowerCase();
    enforceLabels = enforceLabels.split(',').map(function(label) {
      return label.trim();
    });
    checkLabels.enforceLabels = enforceLabels;
  }

  // Authenticate with GitHub
  github.authenticate({
    type: 'oauth',
    token: token
  });

  var action = payload.action,
    pr = {
      number: payload.pull_request.number,
      user: payload.repository.owner.login,
      repo: payload.repository.name,
    };

  console.log('New Action received:' + action);

  if (action !== 'opened' && action !== 'labeled' && action !== 'unlabeled' && action !== 'synchronize') {
    // Ignored
    return callback();
  }

  console.log('Validating PR...');

  // We only want to check the PR status when opened, labeled or unlabeled.
  if (action === 'opened' && checkLabels.defaultLabel) {
    return getIssueLabels(pr)
      .then(function(data) {
        var labels = data.map(function(item) {
            return item.name.trim().toLowerCase();
          }),
          hasDefaultLabel = labels.indexOf(checkLabels.defaultLabel) !== -1;

        // Verify if the PR has the default label when opened.
        console.log('Validating that the PR has the default label ' + checkLabels.defaultLabel + '...');
        if (!hasDefaultLabel) {
          labels.push(checkLabels.defaultLabel);
          pr.labels = labels;

          // The default label is not found in the PR. Add it.
          console.log('Default label not found. Updating PR...');
          editIssue(pr)
            .then(function(data) {
              // Continue with the checks.
              checkLabelStatus(payload, checkLabels, callback);
            });
        } else {
          // The PR already has the default label. Continue with the checks.
          console.log('Default label found. Continuing with checks...');
          checkLabelStatus(payload, checkLabels, callback);
        }
      });
  }

  checkLabelStatus(payload, checkLabels, callback);
};

/** HELPER FUNCTIONS **/
function checkLabelStatus(payload, checkLabels, callback) {
  var status = {
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
        mustOverride = labels.indexOf(checkLabels.overrideLabel) !== -1,
        preventMerge = !checkLabels.preventLabel ? false : labels.indexOf(checkLabels.preventLabel) !== -1,
        hasValidLabels = data.filter(function(label) {
          return checkLabels.enforceLabels.indexOf(label.name.trim().toLowerCase()) !== -1;
        }).length > 0;

      console.log('PR Labels', labels);
      if (mustOverride) {
        console.log('Override label found. Force check success.');
        status.state = 'success';
        status.description = 'Status check overridden.';
      } else if (preventMerge) {
        console.log('Prevent label found. Force check failure.');
        status.state = 'failure';
        status.description = 'PR labeled as `do not merge` (' + checkLabels.preventLabel + ')';
      } else if (hasValidLabels) {
        console.log('PR labels check passed.');
        status.state = 'success';
        status.description = 'Labels check passed.';
      } else {
        console.log('Required labels not found.');
        status.state = 'failure';
        status.description = 'Missing required label(s) to pass check."';
      }
    }

    createStatus(status)
      .then(function(data) {
        callback(null, 'Completed!');
      })
      .catch(function(err) {
        callback("Unable to create GitHub status. Error: " + err);
      });
  });
}
