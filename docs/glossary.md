# Glossary

## Activation

Projects may be started multiple times in multiple configurations. Each of these
running instances is called an _activation_. An activation is the unique
combination of a Kubernetes namespace, a project, a named environment from the
`environments` map of the project's `pelton.cson` file, and an arbitrary
isolation name.

In this way, for example, an object store project can be brought up in its
`test` environment for running integration tests, or its `default` environment
for operating as a proper server to client projects. The `default` environment
could be brought up twice--once in isolation `images` and another in isolation
`videos` if two otherwise-identically-configured instances are required.

It is the responsibility of Pelton projects themselves to enforce that resources
from different activations do not collide or otherwise interfere with each
other. Generally this should be accomplished by generating any resource names
dynamically and including `$PELTON_ENVIRONMENT` and `$PELTON_ISOLATION`.

Environment and isolation names must be valid DNS components, i.e., they must
start with a letter, contain only letters, numbers, and hyphens, and not end
with a hyphen.

Activations are generally identified by ids with the format
`${PRJ_DNS_NAME}.${ENV_NAME}.${ISO_NAME}`, where `$PRJ_DNS_NAME` is the
`dnsName` field of the `pelton.cson` of the project associated with the
activation.

`pelton start` is used to activate a project. For example, to activate the
project in directory `foo/` in its `test` environment and the isolation `bar`:

```shell
pelton start --environment test --isolation bar foo/
```

The default environment is `default` and the default isolation is `a`, so to
bring the same project in directory `foo/` up in its `default` environment and
the isolation `a`:

```shell
pelton start foo/
```

The root activation (and thus its resources) will be assigned to the namespace
specified by `--namespace` (which by default is `default`), while transitive
dependencies will be assigned to the activation's
[dependency namespace](#dependency-namespace).

## Activation Bash Environment

An [activation](#activation)'s bash environment is part of the configuration of
the overall activation environment and defines those environment variables that
are  available to the `build` command during the build step, or the
`printProjectManifest` command during the manifest step. It can also be accessed
via the `pelton environment` command to assist projects in sharing
configuration.

An activation's bash environment is the result of merging the `variables` field
at the top level of the project's `pelton.cson` file (default: `{}`) with the
`variables` field defined in the activation's named environment, with variables
in the named environment taking precedence.

Thus, with a `pelton.cson` file like:

```cson
variables: {
	FOO: "foo-root"
	BAR: "bar-root"
}

environments: {
	default: {
		BAR: "bar-default"
		BAZZ: "bazz-default"
	}

	test: {
		BAR: "bar-test"
		BAZZ: "bazz-test"
	}
}
```

Any activation using the `default` environment would thus have this bash
enviroment set:

```shell
FOO=foo-root
BAR=bar-default
BAZZ=bazz-default
```

And any activation using the `test` environment would thus have this bash
enviroment set:

```shell
FOO=foo-root
BAR=bar-test
BAZZ=bazz-test
```

## Dependency Activation

An [activation](#activation) that was started because it was a transitive
dependency of some [root activation](#root-activation) that was explicitly
started via `pelton start`.

## Dependency Namespace

A Kubernetes namespace created to hold all transitive dependencies of some
[root activation](#root-activation). It is thus intended to be fully managed by
that root activation. The namespace will be called
`${PELTON_DEPENDENCY_NAMESPACE_PREFIX}${ROOT_PRJ_DNS_NAME}-${ROOT_ENV}-${ROOT_ISO}`,
where `$ROOT_PRJ_DNS_NAME` is the `dnsName` field of the root project's
`pelton.cson` file, `$ROOT_ENV` is the root activation's named environment,
`$ROOT_ISO` is the root activation's named isolation, and
`$PELTON_DEPENDENCY_NAMESPACE_PREFIX` is taken from the global environment and
defaults to `pltn-`.

## Root Activation

An [activation](#activation) started by being targetd directly by `pelton start`
as opposed to being brought up as as the
[dependency activation](#dependency-activation) of some root activation.

## Source Activation

The [activation](#activation) whose inclusion has initiated the current process
or contributed the current resource. If the user starts activation A, which
depends on activation B, and activation B emits Kubernetes resource R, then R's
_source activation_ is B.