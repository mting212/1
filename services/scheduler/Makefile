.PHONY: build test lint run

build:
	go build ./...

test:
	go test ./... -v -race

lint:
	go vet ./...

run:
	go run ./cmd/scheduler
