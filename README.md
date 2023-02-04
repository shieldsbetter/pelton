# Pelton!

**Microservices are great. Developing them is not. Pelton can help!**

## What is it?

Pelton modularizes your development environment so that getting your project
running is just a one-line command--even if your project has services as
dependencies that have transitive dependencies of their own!

Your developers can use their preferred OS and their preferred IDE, and bringing
up the project is always just:

```shell
git clone $PROJECT . && vagrant up && vagrant ssh -c 'pelton start /vagrant'
```

## How does it work?

Pelton projects define a `pelton.cson` file that helps Pelton output a complete
Kubernetes manifest describing the project's required runtime environment.
Pelton projects can link to other Pelton projects as dependecies and Pelton will
defer to those projects to bring themselves up in turn!

## Quickstart

You're welcome to install Pelton into your own compatible environment, but we
recommend using our Vagrant box to get running quickly!

```ruby
Vagrant.configure("2") do |config|
  config.vm.box = "shieldsbetter/pelton22"

  config.vm.network :forwarded_port, guest: 80, host: 8080

  config.vm.provider "virtualbox" do |v|
    v.memory = 4096
  end

  config.ssh.forward_agent = true
end
```

Then, just drop a `pelton.cson` file into your project root:

```cson
# Short, DNS-compatible name for your project.
dnsName: 'myproject'

# Each environment is an independent way you can bring up your project. You
# might want one environment for hacking and another for automated tests, for
# example.
environments: {
    # The environment named "default" will be used if no environment is
    # specified.
    default: {
        # Will be Bash `eval`'d before starting your project. A good place to
        # build local images, etc!
        buildCommand: 'bash build-project',

        # Will be Bash `eval`'d. Should print a Kubernetes manifest to `stdout`.
        printTerminalDependencies: 'cat my-k8s-manifest.yaml',

        # An array of Pelton modules to be included as dependencies. Each
        # listed dependency will transitively be given an opportunity to print
        # out its own Kubernetes environment.
        peltonDependencies: [
            {
                # Will be Bash `eval`'d. Should print a local directory
                # containing a Pelton project to `stdout`.
                printProjectDirectory: 'echo /path/to/some-dependency'
            }
        ],

        # A pod label selector used to determine which logs to follow. See:
        # https://kubernetes.io/docs/concepts/overview/working-with-objects/labels/
        podSelector: 'app=my-app'
    }
}
```

Now you can run:

```shell
vagrant ssh -c 'pelton start /vagrant'
```

Your project and each of its transitive dependencies will be given an
opportunity to build themselves, then a complete Kubernetes manifest will be
created with all needed services. Pelton will use `kubectl` to bring up your
project and its terminal (non-Pelton) dependencies in the `default` kubernetes
namespace, while your project's Pelton dependencies will be isolated into a
separate namespace. Once your project comes up, Pelton will tail its logs live
until you press Ctrl+C, at which point your project's resources will be deleted
(but Pelton dependencies will stick around to save time next time you start!)

If you'd like to see the generated kubernetes environment without actually
applying it, you can use the `manifest` command.

```shell
vagrant ssh -c 'pelton manifest /vagrant'
```

## How do I talk to my services?

If you'd like Pelton to spin up an Ingress and make your HTTP(S) services
available from the Vagrant host, you can use the included
`generate-service-ingresses` plugin.

Include this annotation in any services that should be accessible to the Vagrant
host:

```yaml
apiVersion: v1
kind: Service
metadata:
    name: my-svc
    annotations:
        com.shieldsbetter.pelton/ingress: "foo:1234"   # <-- Add this!
```

Then change your `pelton start` command to:

```shell
vagrant ssh -c 'pelton start --plugin "pelton extras plugin generate-service-ingresses" /vagrant'
```

Pelton will automatically generate a kubernetes Ingress resource to map
`foo.localhost` through to your service's 1234 port. Provided you have port 8080
mapped to 80 in your Vagrantfile, you could then navigate to your service in
a browser at `foo.localhost:8080`.

If your project has Pelton dependencies that themselves expose their services,
those will be available as a subdomain of your project's `dnsName`, for example,
`somedependency.myproject.localhost:8080`.

Omitting a hostname in the annotation (e.g., ":1234") will default to using the
project's `dnsName`.
