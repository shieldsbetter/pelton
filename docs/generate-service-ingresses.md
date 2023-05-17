# pelton extras plugins generate-service-ingresses

A plugin for exposing annotated services to the outside world via HTTP
ingresses.

This plugin reads a stream of Kubernetes resources formatted as yaml documents
and outputs a modified set of Kubernetes resources as yaml documents. It is thus
suitable for use with `pelton manifest --plugin`.

The input resources are re-output verbatim. In addition, input
[Service](https://kubernetes.io/docs/concepts/services-networking/service/)-kind
resources annotated with the `com.shieldsbetter.pelton/ingress` annotation are
found and one additional
[Ingress](https://kubernetes.io/docs/concepts/services-networking/ingress/)-kind
resources is output for each namespace represented across those services.

Values for the annotation should take the form `prefix=>port,prefix=>port`.
I.e., a comma-delimited list of prefix/port pairs, where prefix and port are
separated by the characters `=>`.

Each output ingress will contain
[Rules](https://kubernetes.io/docs/concepts/services-networking/ingress/#ingress-rules)
mapping [FQDNs](https://en.wikipedia.org/wiki/Fully_qualified_domain_name)
derived from the provided domain name prefixes to the requested ports on the
associated service.

In the case of services whose source activation is the same as the root
activation, each specified port will be exposed at a FQDN formed by combining
the requested domain prefix to each suffix specified in the environment
variable `$PELTON_GSI_DOMAIN_SUFFIX`.

In all other cases, each specified port will be exposed by combining the
requested domain prefix first with each fragment specified in the environment
variable `$PELTON_GSI_DEPENDENCY_FRAGMENT` and then pairwise with each suffix
in `$PELTON_GSI_DOMAIN_SUFFIX`.

`$PELTON_GSI_DOMAIN_SUFFIX`'s default is `.localhost`.

`$PELTON_GSI_DEPENDENCY_FRAGMENT`'s default is
`.${ROOT_PRJ_DNS_NAME_NO_HYPHENS}-${ROOT_ENV}-${ROOT_ISO}`, where
`ROOT_PRJ_DNS_NAME_NO_HYPHENS` is the `dnsName` field of the Pelton project
associated with the root activation, `ROOT_ENV` is the root activation's
environment name, and `ROOT_ISO` is the root activation's isolation name.

Thus, a service annotated with `svcA=>123` from the root activation would,
by default, have its port 123 exposed as `svcA.localhost`, while a service
annotated with `svcB=>124` from a dependency activation spawned by root
activation `prj-a.default.a` would, by default, have its port 124 exposed as
`svcB.prja-default-a.localhost`.

## Full Behavior

### Environment

The plugin is sensitive to two environment variables:

* `PELTON_GSI_DOMAIN_SUFFIX` - a comma-delimeted list of suffixes to be used
  for each rule. E.g., `.localhost,.corp.biz.com`. Default: `.localhost`.
* `PELTON_GSI_DEPENDENCY_FRAGMENT` - a comma-delimeted list of
  partial domain names to be combined pairwise with suffixes in
  `PELTON_GSI_DOMAIN_SUFFIX` to form suffixes for services not originating from
  the root activation. Default:
  `.${ROOT_PRJ_DNS_NAME_NO_HYPHENS}-${ROOT_ENV}-${ROOT_ISO}`, where
  `ROOT_PRJ_DNS_NAME_NO_HYPHENS` is the `dnsName` field of the Pelton project
  associated with the root activation, `ROOT_ENV` is the root activation's
  environment name, and `ROOT_ISO` is the root activation's isolation name.

### Annotation

The `com.shieldsbetter.pelton/ingress` annotation should be set on any service
for which rules should be generated.

The value of the annotation should be a string formatted as one or more
comma-delimited mappings from a domain prefix to one of the service's ports.
Each individual mapping should be formatted as `${DOMAIN_PREFIX}=>${PORT}`, that
is: a domain prefix, followed by the characters `=>`, followed by a port number
exposed by the service. The domain prefix and arrow may be ommitted, in which
case a default domain prefix will be generated.

So, the following are all examples of valid annotation values:

* `foo.plugh=>123`
* `foo=>123,bar.waldo=>124`
* `123`
* `foo=>123,124`

When the domain prefix is omitted, a default will be generated based on the
service's `metadata.name` field. The generated default will be
`${SVC_NAME_NO_HYPHENS}-${ENV}-${ISO}`, where `SVC_NAME_NO_HYPHENS` is the name
of the service with hyphens removed, `ENV` is the environment name of the
activation associated with the service, and `ISO` is the isolation name of the
activation associated with the service. Thus, for service `foo-svc` that is part
of the `foo-prj` project that has been activated in activation
`foo-prj.default-a`, the generated default prefix would be `foosvc-default-a`.

Each mapping will cause the plugin to generate one or more rules on the Ingress
in the corresponding namespace.

### Generated FQDNs

For each namespace, one Ingress will be generated exposing the services from
that namespace.

For each service in a namespace, each mapping will contribute one or more rules
to that ingress.

For services whose source activation is the root activation, each mapping will
be considered and its domain prefix prepended to each suffix from
`$PELTON_GSI_DOMAIN_SUFFIX`, contributing a number of rules equal to the number
of suffixes.

For services whose source activation is _not_ the root activation, each mapping
will be considered and its domain prefix prepended first to those domain
fragments in `$PELTON_GSI_DEPENDENCY_FRAGMENTS` and that resulting list combined
pairwise with each suffix from `$PELTON_GSI_DOMAIN_SUFFIX`, contributing a
number of rules equal to (n * m) where _n_ is the number of fragments in
`$PELTON_GSI_DEPENDENCY_FRAGMENTS` and _m_ is the number of suffixes in
`$PELTON_GSI_DOMAIN_SUFFIX`.
