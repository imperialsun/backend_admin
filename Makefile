.DEFAULT_GOAL := check

.PHONY: lint test build check

NPM ?= npm
VITEST_ARGS ?= --run --maxWorkers=1 --no-file-parallelism

lint:
	$(NPM) run lint

test:
	$(NPM) run test -- $(VITEST_ARGS)

build:
	$(NPM) run build

check: lint test build
