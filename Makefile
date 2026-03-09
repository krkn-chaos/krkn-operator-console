# Makefile for krkn-operator-console
# Frontend React application for krkn chaos engineering ecosystem

# Component name
COMPONENT = krkn-operator-console

# Registry configuration
REGISTRY ?= quay.io/krkn-chaos

# Image name
IMG_NAME ?= $(COMPONENT)

# Git tag detection for versioning
GIT_TAG ?= $(shell git describe --tags --exact-match 2>/dev/null)

# Full image URL - defaults to latest, can be fully overridden with IMG=
IMG ?= $(REGISTRY)/$(IMG_NAME):latest

# CONTAINER_TOOL defines the container tool to be used for building images.
# Can be docker or podman
CONTAINER_TOOL ?= docker

# Node/NPM configuration
NPM ?= npm

# Setting SHELL to bash allows bash commands to be executed by recipes.
SHELL = /usr/bin/env bash -o pipefail
.SHELLFLAGS = -ec

.PHONY: all
all: build

##@ General

.PHONY: help
help: ## Display this help
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage:\n  make \033[36m<target>\033[0m\n"} /^[a-zA-Z_0-9-]+:.*?##/ { printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2 } /^##@/ { printf "\n\033[1m%s\033[0m\n", substr($$0, 5) } ' $(MAKEFILE_LIST)

##@ Development

.PHONY: install
install: ## Install npm dependencies
	$(NPM) install

.PHONY: build
build: ## Build the React application for production
	$(NPM) run build

.PHONY: dev
dev: ## Run development server
	$(NPM) run dev

.PHONY: test
test: ## Run tests
	$(NPM) test

.PHONY: test-coverage
test-coverage: ## Run tests with coverage
	$(NPM) run test:coverage

.PHONY: lint
lint: ## Run linter
	$(NPM) run lint

.PHONY: clean
clean: ## Clean build artifacts and dependencies
	rm -rf node_modules dist

##@ Container Build

.PHONY: docker-build
docker-build: ## Build container image with docker
	$(CONTAINER_TOOL) build -t ${IMG} .
ifeq ($(origin IMG)$(origin REGISTRY)$(origin IMG_NAME),filefilefile)
ifneq ($(strip $(GIT_TAG)),)
	$(CONTAINER_TOOL) tag ${IMG} $(REGISTRY)/$(IMG_NAME):$(GIT_TAG)
	@echo "✓ Built and tagged: ${IMG} and $(REGISTRY)/$(IMG_NAME):$(GIT_TAG)"
else
	@echo "✓ Built: ${IMG}"
endif
else
	@echo "✓ Built: ${IMG} (override detected, git tag skipped)"
endif

.PHONY: docker-push
docker-push: ## Push container image with docker
	$(CONTAINER_TOOL) push ${IMG}
ifeq ($(origin IMG)$(origin REGISTRY)$(origin IMG_NAME),filefilefile)
ifneq ($(strip $(GIT_TAG)),)
	$(CONTAINER_TOOL) push $(REGISTRY)/$(IMG_NAME):$(GIT_TAG)
	@echo "✓ Pushed: ${IMG} and $(REGISTRY)/$(IMG_NAME):$(GIT_TAG)"
else
	@echo "✓ Pushed: ${IMG}"
endif
else
	@echo "✓ Pushed: ${IMG} (override detected, git tag skipped)"
endif

.PHONY: podman-build
podman-build: ## Build container image with podman
	$(MAKE) docker-build CONTAINER_TOOL=podman

.PHONY: podman-push
podman-push: ## Push container image with podman
	$(MAKE) docker-push CONTAINER_TOOL=podman
