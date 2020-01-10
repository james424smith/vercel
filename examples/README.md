# ZEIT Now Examples

This is the public list of examples for **ZEIT Now**.

All of these ready to deploy examples feature a frontend framework or static site, created with zero configuration using the CLI tools they provide.

The `+functions` examples feature an `/api` directory as well, highlighting how to use serverless functions on top of a framework, again with zero configuration required.

## What is ZEIT Now?

ZEIT Now is a cloud platform for static frontends and serverless functions. It enables developers to host websites and web applications that deploy instantly, scale automatically, and require no supervision.

## What Does this Repository Contain?

This repository consists of multiple examples, created for use with the [ZEIT Now](https://zeit.co/now) platform. In addition to this, it also contains:

- [Code of Conduct](https://github.com/zeit/now/blob/master/.github/CODE_OF_CONDUCT.md) - our Code of Conduct, adapted from the [Contributor Covenant](http://contributor-covenant.org)
- [Contributing Guidelines](https://github.com/zeit/now/blob/master/.github/CONTRIBUTING.md) - a guide on how to contribute to the Now Examples repository
- [License](https://github.com/zeit/now/blob/master/LICENSE) - the standard MIT license under which these examples are published

We recommend familiarizing yourself with the above sections, particularly if you are looking to make a contribution.

## Deploying Examples

To get started using any of these examples as your own project, [install Now](https://zeit.co/download) and use either of the following commands in your terminal:

```sh
now init                    # Pick an example in the CLI
now init <example>          # Create a new project from a specific <example>
now init <example> <name>   # Create a new project from a specific <example> with a different folder <name>
```

Deploying your project takes seconds and can be done with **just a single command**:

```sh
now                         # Deploys the project with Now
```

With the `now` command, your project will be built and served by Now, providing you with a URL that can be shared immediately.

## New Examples

We are continuously improving our examples based on best practices and feedback from the community. As a result, it is possible that example names will change and on occasion deprecated in favor of an improved implementation.

For example, the previous `nodejs` example showed a static frontend with a Node.js API. This is illustrated now in the `svelte` example. Below is a table that lists some of the most popular previous examples and the equivalent replacement:

| Previous Example  | New Example                                                                           |
| ----------------- | ------------------------------------------------------------------------------------- |
| **monorepo**      | [gatsby-functions](https://github.com/zeit/now/tree/master/examples/gatsby)           |
| **nodejs**        | [svelte-functions](https://github.com/zeit/now/tree/master/examples/svelte)           |
| **nextjs-static** | [nextjs](https://github.com/zeit/now/tree/master/examples/nextjs)                     |
| **vanilla-go**    | [create-react-app](https://github.com/zeit/now/tree/master/examples/create-react-app) |
| **typescript**    | [gatsby-functions](https://github.com/zeit/now/tree/master/examples/gatsby)           |

## Migrating and Upgrading

If you have an existing project you would like to deploy with ZEIT Now, we recommend reading our guide on [migrating to Now and zero configuration](https://zeit.co/guides/migrate-to-zeit-now/). By combining the guide with this repository, you will quickly be able to understand how to deploy your application.

If you would like to upgrade a project to take advantage of zero configuration, you may find the [upgrade guide](https://zeit.co/guides/upgrade-to-zero-configuration/) useful. The upgrade guide covers how to remove configuration from existing projects along with how to use the `/api` directory.

## How to Contribute

Contributing to Now Examples should be an enjoyable experience, as such we have created a set of [contributing guidelines](https://github.com/zeit/docs/blob/master/CONTRIBUTING.md) to help you do so.

The guidelines cover important information such as the requirements for new examples and where to get help if you have any questions.

We have tried to make contributing to Now Examples as easy as possible, especially for those new to Open Source. If anything is unclear or you have any questions then please reach out to us on [ZEIT Spectrum](https://spectrum.chat/zeit) where we will do our best to help you.

## Reporting Issues

We actively encourage our community to raise issues and provide feedback on areas of Now Examples that could be improved.

An issue can be raised by clicking the 'Issues' tab at the top of the repository, followed by the Green 'New issue' button.

When submitting an issue, please thoroughly and concisely describe the problem you are experiencing so that we may easily understand and resolve the issue in a timely manner.

## License

Now Examples is an open source project released under the [MIT License](https://github.com/zeit/docs/blob/master/LICENSE.md).

## Get In Touch

If you have any questions that are not covered by raising an issue then please get in touch with us on the [ZEIT Spectrum](https://spectrum.chat/zeit). There you will find both members of the community and staff who are happy to help answer questions on anything ZEIT related.

[![Join the community on Spectrum](https://withspectrum.github.io/badge/badge.svg)](https://spectrum.chat/zeit)
