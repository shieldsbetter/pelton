# Pelton Vagrant Box

This project provides a Vagrant box that is the only officially-supported Pelton
platform. It provides some services and utilities defined here.

Boxes are named `shieldsbetter/peltonXX`, where XX is a two digit number
corresponding to the major version number of the `bento/ubuntuXX.YY` LTS version
upon which they are based. Thus `pelton22` is the Pelton Vagrant box based on
the `bento/ubuntu22.04` base box. It is our intention to support every LTS
version of Ubuntu shortly after it is released, and maintain support until that
Ubuntu version reaches end of life.

Currently the only available supported box is `shieldsbetter/pelton22`.

## Services and Tools

Beyond services and tools available in the ubuntu base box, Pelton guarantees
these:

* [`docker`](https://www.docker.com/) - the docker command line tools
* [`microk8s`](https://microk8s.io/) - preconfigured with the
  [`dns`](https://microk8s.io/docs/addon-dns),
  [`host-access`](https://microk8s.io/docs/addon-host-access),
  [`hostpath-storage`](https://microk8s.io/docs/addon-hostpath-storage),
  [`ingress`](https://microk8s.io/docs/addon-ingress),
  and [`registry`](https://microk8s.io/docs/registry-built-in) add-ons.
  For convenience `KUBECTL_CMD` is globally set to `microk8s kubectl` so that
  the `pelton` CLI works out of box, and a bash alias appears in the default
  `vagrant` user's `.bashrc` aliasing `kubectl` to `microk8s kubectl`.
* [`pelton`](./pelton-cli-usage.md) - the `pelton` CLI
* `wait-for-registry` - simple utility to wait until $PELTON_DOCKER_REGISTRY is
  up and ready to serve (which can take quite a while on `vagrant up`)

## Environment

* `KUBECTL_CMD` - globally set to `microk8s kubectl` to allow `pelton` CLI to
  work out of box with the local `microk8s` service
* `PATH` - defined to include `/pelton-project-extensions/bin` for easy
  addition of binaries from the project
* `PELTON_DOCKER_REGISTRY` - globally set to a URL suitable for use with
  `docker push $PELTON_DOCKER_REGISTRY/myImageName` to point at the `microk8s`
  `registry` service

## Extension Points

### Project-defined `bin`s

`PATH` is set to include `/pelton-project-extensions/bin` for easy addition
of scripts from the project. Simply mount the project folder containing your
additional scripts in your Vagrantfile:

```ruby
    config.vm.synced_folder "some/project/scripts/dir",
    		"/pelton-project-extensions/bin",
        	mount_options: ["dmode=775,fmode=777"]
```
