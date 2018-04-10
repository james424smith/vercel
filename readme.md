![now](https://github.com/zeit/art/blob/a7867d60f54a41127023a8740a221921df309d24/now-cli/repo-banner.png?raw=true)

[![Build Status](https://circleci.com/gh/zeit/now-cli.svg?&style=shield)](https://circleci.com/gh/zeit/workflows/now-cli) [![Join the community on Spectrum](https://withspectrum.github.io/badge/badge.svg)](https://spectrum.chat/now)

**Note**: The [canary](https://github.com/zeit/now-cli/tree/canary) branch is under heavy development – the stable release branch is [master](https://github.com/zeit/now-cli/tree/master).

## Usage

To install the latest version of Now CLI, run this command:

```
npm install -g now
```

There are also [other installation methods](https://zeit.co/download) available.

## Documentation

For details on how to use Now CLI, check out our [documentation](https://zeit.co/docs).

## Caught a Bug?

1. [Fork](https://help.github.com/articles/fork-a-repo/) this repository to your own GitHub account and then [clone](https://help.github.com/articles/cloning-a-repository/) it to your local device
2. Link the package to the global module directory: `yarn run link` (not `yarn link`)
3. You can now start using `now` from the command line!

As always, you can use `yarn test` to run the tests and see if your changes have broken anything.

## How to Create a Release

If you have write access to this repository, this is how you can create a new release: 

- **Stable release:** Run `release <major|minor|patch>` (depending on the version bump you're planning to do) on the `master` branch.

- **Canary release:** Run `release pre` on the `canary` branch.

After you've run the command, monitor [this page](https://circleci.com/gh/zeit/now-cli) and wait for Circle CI to upload the binaries to the release. Once that's done and the tests are passing, hit "Publish" on the GitHub release.
