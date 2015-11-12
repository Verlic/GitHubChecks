# Webtask - GitHub Label Status Check

A custom status check for GitHub that verifies that your Pull Requests are correctly labeled.

## How does it work?

Everytime you open, label, or push changes to your Pull Requests it'll request a check to the Webtask. The Webtask will verify your PR and create a status check.

This is how your GitHub shows the status check when it passed:

![Check passed](https://cloud.githubusercontent.com/assets/6725407/11134323/7f75b6f0-897a-11e5-868a-833cb165a04d.png)


And if there are invalid or no labels, the check will fail like this:

![Check failed](https://cloud.githubusercontent.com/assets/6725407/11134338/9cf60b4e-897a-11e5-8a0d-9e821640fb0d.png)

## Creating a Webtask Account

Webtask are incredibly easy to use and fast to build. To create your own **Webtask container**, sign-up for free [here](https://webtask.io/cli) and follow the steps to install the **Webtask CLI** in your computer.

## Creating the Status Check Webtask

The Webtask requires a GitHub token in order to access your Pull Requests. You can generate one by following these [steps](https://github.com/blog/1509-personal-api-tokens).

Once Webtask is installed and initialized in your computer you simply need to create the Webtask by executing the following command (replace the API TOKEN placeholder with your personal access token):

````
wt create custom-status-check.js --name statuscheck --secret GITHUB_API_TOKEN={YOUR-GITHUB-TOKEN}
````

Take note of the URL generated for your Webtask. You'll use this to configure the Webhook in GitHub.

Go to your repository settings, select **Webhooks & services** and click on **Add Webhook**. In the **Payload URL** field paste your Webtask URL. The Webtask has the default labels to check: feature, bug fixing, product refactor, and code refactor.

You can specify 2 parameters to the hook: Default and Prevent. The first will add a default label whenever a Pull Requests is **opened**. The latter will forcefully fail the check if the label is present in the PR.

For example, you can configure your Webhook to set the label 'review' as **default** and the label 'dont-merge' as your **prevent** parameter. Like this:

````
https://{webtask-url}?default=review&prevent=dont-merge
````

Select the option **Let me select individual events** and mark **Pull Request**. Save the webhook.

> **Note:** You can see more information about Webhook [here](https://github.com/blog/1778-webhooks-level-up).

That's it. You have your Webtask waiting input from your Pull Requests.

### More info

For more information about **Webtasks** go to https://webtask.io/. Read this [article](https://webtask.io/docs/how) to understand how it works.
