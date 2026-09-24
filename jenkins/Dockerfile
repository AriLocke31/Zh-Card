FROM jenkins/jenkins:lts-jdk21

USER root

RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl unzip zip git gnupg
RUN mkdir -p /etc/apt/keyrings
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
RUN apt-get install -y --no-install-recommends nodejs
RUN rm -rf /var/lib/apt/lists/*

RUN  set -eux; \
  arch="$(dpkg --print-architecture)"; \
  case "$arch" in \
    amd64) aws_arch="x86_64" ;; \
    arm64) aws_arch="aarch64" ;; \
    *) exit 1 ;; \
  esac; \
  curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-${aws_arch}.zip" -o /tmp/awscliv2.zip; unzip -q /tmp/awscliv2.zip -d /tmp; \
  /tmp/aws/install; \
  rm -rf /tmp/aws /tmp/awscliv2.zip

ARG HELPER_VERSION=1.8.5
ARG HELPER_SHA256=beec9ed1c492d93db809890f16713e3556353294b823c2184ad4e891f1b2b54d

RUN set -eux; \
  test "$(dpkg --print-architecture)" = "amd64"; \
  curl -fsSL "https://rolesanywhere.amazonaws.com/releases/${HELPER_VERSION}/X86_64/Linux/Amzn2023/aws_signing_helper" \
  -o /usr/local/bin/aws_signing_helper; \
  echo "${HELPER_SHA256} /usr/local/bin/aws_signing_helper" | sha256sum -c -; \
  chmod 755 /usr/local/bin/aws_signing_helper

RUN node --version && npm --version && git --version && aws --version && zip --version | head -n 2

USER jenkins

RUN jenkins-plugin-cli --plugins workflow-aggregator git configuration-as-code
