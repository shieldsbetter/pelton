#!/bin/bash

function provisionVagrant() {
    apt-get update

    if ! which docker &>/dev/null; then
        curl -fsSL https://get.docker.com -o - | sh
    fi

    if ! which microk8s &>/dev/null; then
        snap install microk8s --classic
        microk8s status --wait-ready
    fi

    microk8s enable dns host-access hostpath-storage ingress registry

    usermod -a -G microk8s vagrant
    chown -f -R vagrant ~/.kube

    if ! grep '# Alias kubectl' /home/vagrant/.bashrc >/dev/null; then
        echo 'alias kubectl="microk8s kubectl"   # Alias kubectl' \
                > /home/vagrant/.bashrc
    fi

    if ! grep '^KUBECTL_CMD=' /etc/environment >/dev/null; then
        echo 'KUBECTL_CMD="microk8s kubectl"' > /etc/environment
    fi

    if [[ -z "$(getent group docker)" ]]; then
        groupadd docker
    fi
    usermod -aG docker vagrant

    if ! which node; then
        curl -sL https://deb.nodesource.com/setup_18.x | bash -
        apt-get install -y nodejs
    fi

    if ! which pelton; then
        npm install -g @shieldsbetter/pelton3
    fi
}

provisionVagrant
