Vagrant.configure("2") do |config|
    config.vm.box = "bento/ubuntu-22.04"
    config.ssh.forward_agent = true

    config.vm.provider "virtualbox" do |v|
      v.memory = 4096
    end

    config.vm.network :forwarded_port, guest: 80, host: 8080

    config.vm.provision "shell", env: {
        "PELTON_VAGRANT_PACKAGING"=>ENV['PELTON_VAGRANT_PACKAGING']
    }, inline: <<-SCRIPT
        set -e

        apt-get update

        if ! which node; then
            curl -sL https://deb.nodesource.com/setup_18.x | sudo -E bash -
            sudo apt-get install -y nodejs
        fi

        if [[ -n "$PELTON_VAGRANT_PACKAGING" ]]; then
            npm install -g "@shieldsbetter/pelton@$PELTON_VAGRANT_PACKAGING"
        else
            cd /vagrant
            npm link
        fi

        if ! which docker &>/dev/null; then
            curl -fsSL https://get.docker.com -o - | sh
        fi

        if ! which microk8s &>/dev/null; then
            snap install microk8s --classic
            microk8s status --wait-ready
        fi

        microk8s enable dns host-access hostpath-storage ingress registry

        if ! grep 'PELTON_DOCKER_REGISTRY' /etc/environment >/dev/null; then
            echo 'PELTON_DOCKER_REGISTRY=localhost:32000' >> /etc/environment
        fi

        usermod -a -G microk8s vagrant
        chown -f -R vagrant ~/.kube

        if ! grep '# Alias kubectl' /home/vagrant/.bashrc >/dev/null; then
            echo 'alias kubectl="microk8s kubectl"   # Alias kubectl' \
                    > /home/vagrant/.bashrc
        fi

        if ! grep 'KUBECTL_CMD' /etc/environment >/dev/null; then
            echo 'KUBECTL_CMD=microk8s kubectl' >> /etc/environment
        fi

        if [[ -z "$(getent group docker)" ]]; then
            groupadd docker
        fi
        usermod -aG docker vagrant
    SCRIPT
end
