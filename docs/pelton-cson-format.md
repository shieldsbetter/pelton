# `pelton.cson` format

Each Pelton project must defined a `pelton.cson` file at its root, structured
in [CSON](https://github.com/bevry/cson) format.

## Root fields

* `dnsName` - **Required.** The name of the project as a valid DNS component,
  i.e. starting with a letter, consisting of only letters, numbers, and hyphens,
  and not ending in a hyphen. Projects with identical `dnsName`s cannot exist
  within each others' dependency trees.
* `environments` - **Required.** A map of named activation environments,
  further specified in the [Environments](#environments-section) section.
* `variables` - (Optional.) A set of environment variables defined by default
  for each environments'
  [activation bash environment](./glossary.md#activation-bash-environment).

## `environments` section

The key of each entry in the `environments` map defines the name of the
environment and must be formatted as a DNS component--that is, it must begin
with a letter, consist only of letters, numbers, and hyphens, and not end with
a hyphen.

The value of each entry should itself be a map with the following fields:

* `build` - (Optional.) A string supplying a bash command to be `eval`'d during
  the build phase. Will be `eval`'d in the bash variable environment defined
  in [pelton build](./pelton-cli-usage.md#pelton-build-root-project-directory).
  When the build phase is followed by the manifest or start phases, the final
  1000 characters (minus any trailing newline) of standard out will be stored as
  `PELTON_BUILD_RESULT` and made available in the environment of the manifest
  and start phases.
* `dependencies` - (Optional.) An array of dependency Pelton projects to be
  included when bringing up an activation in the defined environment. Each entry
  should be a map with the following fields:
    * `environment` - (Optional.) The named
      [activation](./glossary.md#activation) environment to be used for the
      dependency activation. Default: `default`.
    * `isolation` - (Optional.) The named activation isolation to be used for
      the dependency activation. Default: `a`.
    * `printProjectDirectory` - **Required.** A command to be `eval`'d to print
      to standard out an absolute directory or directory relative to the
      project's `pelton.cson` file where the dependency project can be found.
      Will be `eval`'d
      [activation bash environment](./glossary.md#activation-bash-environment)
      of the associated Pelton environment.
* `printProjectManifest` - (Optional.) A string supplying a bash command to be
  `eval`'d during the manifest phase to print the project's kubernetes resources
  to standard out, formatted as yaml. Will be `eval`'d in the bash variable
  environment defined in
  [pelton manifest](./pelton-cli-usage.md#pelton-manifest-root-project-directory).
* `podSelector` - (Optional.)
  A [pod selector](https://kubernetes.io/docs/concepts/overview/working-with-objects/labels/#label-selectors)
  for use identifying pods whose logs should be followed when running
  `pelton start`.