# Pelton CLI Usage

Usage:

```shell
pelton <subcommand>
```

Where `<subcommand>` should be one of:

* `build` - build target and all dependencies
* `extras` - access useful extras
* `manifest` - generate k8s manifest for target and dependencies
* `start` - start target with its dependencies
* `variables` - print environment variables

The following global flags are available:

* `--debug` - output additional debug output
* `--notty` - disable pretty output

## `pelton build <root-project-directory>`

If not provided, `<root-project-directory>` will default to `.`.

Flags:

* `--environment` or `-e` - activation environment (default: "default")
* `--isolation` or `-i` - activation isolation key (default: "a")
* `--namespace` or `-n` - target Kubernetes namespace for root activation
  resources

Builds the specified [activation](./glossary.md#activation) of the project,
along with any transitively dependent activations.

"Building" an activation consists of first waiting for any dependencies to
finish building, then Bash `eval`-ing the activation's environment's `build`
field in the follow shell environment:

* `PELTON_DEPENDENCY_POD_DOMAIN`: the domain suffix where Kubernetes pods from
  Pelton dependencies will be available. Inter-cluster communication can thus
  target the FQDN `<pod-ip>.$PELTON_DEPENDENCY_POD_DOMAIN`.
* `PELTON_DEPENDENCY_SERVICE_DOMAIN`: the domain suffix where Kubernetes
  services from Pelton dependencies will be available. Inter-cluster
  communication can thus target the FQDN
  `<service-name>.$PELTON_DEPENDENCY_SERVICE_DOMAIN`.
* `PELTON_ENVIRONMENT`: the activation's named Pelton environment
* `PELTON_ISOLATION`: the activation's Pelton isolation
* `PELTON_PROJECT_POD_DOMAIN`: the domain suffix where Kubernetes pods from the
  root Pelton project will be available. Inter-cluster communication can thus
  target the FQDN `<pod-ip>.$PELTON_PROJECT_POD_DOMAIN`.
* `PELTON_PROJECT_SERVICE_DOMAIN`: the domain suffix where Kubernetes services
  from the root Pelton project will be available. Inter-cluster communication
  can thus target the FQDN `<service-name>.$PELTON_PROJECT_SERVICE_DOMAIN`.
* `PELTON_ROOT_ACTIVATION`: the activation id of the root activation.
* `PELTON_SOURCE_ACTIVATION`: the activation id of the source activation.

Additionally, any environment variables in the activation's defined
[activation bash environment](./glossary.md#activation-bash-environment) will
be available.

## `pelton extras <subcommand>`

Only one `<subcommand>` is currently available:

* `plugins` - Plugins suitable for use with `pelton manifest --plugin`

### `pelton extras plugins <subcommand>`

Only one `<subcommand>` is currently available:

* `generate-service-ingresses` - add `Ingress` resources that map external hosts
  to internal services based on annotations

#### `pelton extras plugins generate-service-ingresses`

See [the plugin's documentation](./generate-service-ingresses.md).

## `pelton manifest <root-project-directory>`

If not provided, `<root-project-directory>` will default to `.`.

Flags:

* `--environment` or `-e` - activation environment (default: "default")
* `--isolation` or `-i` - activation isolation key (default: "a")
* `--namespace` or `-n` - target Kubernetes namespace for root activation
  resources
* `--plugin` or `-p` - a command to run filter the resulting manifest through.
  May be specified multiple times.

First, builds the root activation and its transitive dependencies.

The, prints a complete Kubernetes manifest for the specified
[activation](./glossary.md#activation) to standard out, suitable for use with
`kubernetes apply`. The manifest will be derived by Bash `eval`-ing any
`printProjectManifest` commands defined on the root activation and any
transitively dependent activations, performing some Pelton-specific annotation
of resulting resources, and then passing the resulting manifest on standard in
to each `--plugin` in turn, piping that plugin's standard out to the next
plugin's standard in, until there are no plugins remaining and the resulting
manifest is printed.

Resources printed by `printProjectManifest` must not contain a
`metadata.namespace` field, as this field will be assigned appropriately by
Pelton--to the namespace specified by `--namespace` for resources whose source
is the root activation, and to
`${PELTON_DEPENDENCY_NAMESPACE_PREFIX}${ROOT_PRJ_DNS_NAME}-${ROOT_ENV}-${ROOT_ISO}`
otherwise. `$PELTON_DEPENDENCY_NAMESPACE_PREFIX` defaults to `pltn-`.

`printProjectManifest` commands will be run in the same environment as specified
for `pelton build`, with additionally:

* `PELTON_BUILD_RESULT`: the last 1000 characters of the standard output of the
  activation's `build` command. This can be particularly useful, for example, to
  allowing `build` to print a resulting docker image hash to later be embedded
  in the activation's manifest.
* `PELTON_EXTRA_ARGS`: a JSON-formatted (and thus YAML-formatted) array. For
  [dependency activations](./glossary.md#dependency-activation), this will
  always be the empty array. However, for the
  [root activation](./glossary.md#root-activation) it will be an array of
  strings containing any additional command line arguments. So if
  `pelton manifest` is invoked as:

  ```shell
  pelton manifest . foo --bar
  ```

  Then `PELTON_EXTRA_ARGS` will be `["foo","--bar"]`. Extra arguments are those
  that appear after the specified `<root-project-directory>`, which must be
  provided in order to provide additional arguments.

## `pelton start <root-project-directory>`

If not provided, `<root-project-directory>` will default to `.`.

Flags:

* `--detach` or `-d` - return after applying the manifest. Do not wait for a
  live pod, follow logs, or tear down.
* `--environment` or `-e` - activation environment (default: "default")
* `--isolation` or `-i` - activation isolation key (default: "a")
* `--namespace` or `-n` - target Kubernetes namespace for root activation
  resources
* `--plugin` or `-p` - a command to run filter the resulting manifest through.
  May be specified multiple times.

First, builds the root activation and its transitive dependencies.

Then, derives a complete manifest of the root activation and its transitive
dependencies as with `pelton manifest` and `apply --prune`s that manifest using
`$KUBECTL_CMD` (which defaults to `kubectl`). Required namespaces will be
created if they do not exist.

If `--detach` is provided or the root activation defines no `podSelector` field,
then once the `$KUBECTL_CMD apply` command returns, `pelton start` itself will
return, leaving all resources running.

Otherwise, Pelton will wait for at least one pod matching the given
`podSelector` to enter the `Running` phase. It will then begin to tail logs.
Once Pelton recieves SIGINT (usually Control+C) it will prune root activation
resources via a follow-up `apply --prune`, leaving dependency activation
resources running.

Once `apply --prune` returns and all pods whose logs are being followed have
terminated, `pelton start` will return. A second SIGINT during this shutdown
sequence will force Pelton to terminate immediately, potentially leaving root
activation resources running.

## `pelton variables <root-project-directory>`

If not provided, `<root-project-directory>` will default to `.`.

Flags:

* `--environment` or `-e` - activation environment (default: "default")
* `--isolation` or `-i` - activation isolation key (default: "a")

Prints the specified activation's
[activation bash environment](./glossary.md#activation-bash-environment) as
`KEY=VALUE` lines suitable to be `eval`'d.