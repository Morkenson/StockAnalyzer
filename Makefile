.PHONY: help test coverage backend-test backend-coverage backend-integration-test frontend-test coverage-summary e2e e2e-install e2e-headed e2e-report clean-coverage up down build rebuild logs ps backend-shell frontend-shell clean

help:
	@echo "Available targets:"
	@echo "  make test              Run all configured tests"
	@echo "  make coverage          Run all configured tests with coverage scores"
	@echo "  make backend-test      Run backend pytest suite"
	@echo "  make backend-coverage  Run backend pytest suite with coverage"
	@echo "  make backend-integration-test  Run PostgreSQL migration integration tests (requires docker compose up db -d)"
	@echo "  make frontend-test     Run frontend Jest suite with coverage"
	@echo "  make e2e-install       Install Playwright and browsers"
	@echo "  make e2e               Run Playwright e2e tests (requires running dev server)"
	@echo "  make e2e-headed        Run Playwright e2e tests in headed mode"
	@echo "  make e2e-report        Open last Playwright HTML report"
	@echo "  make clean-coverage    Remove generated coverage output"
	@echo "  make up                Start Docker services"
	@echo "  make down              Stop Docker services"
	@echo "  make build             Build Docker images"
	@echo "  make rebuild           Rebuild and start Docker services"
	@echo "  make logs              Follow Docker service logs"
	@echo "  make ps                Show Docker service status"
	@echo "  make clean             Stop Docker services and remove volumes"

test: backend-integration-test coverage

coverage: backend-coverage frontend-test coverage-summary

backend-test:
	cd backend && python -m pytest

backend-integration-test:
	docker compose up db -d
	cd backend && python -m pytest -m integration -v

backend-coverage:
	cd backend && python -m pytest --cov=. --cov-config=.coveragerc --cov-report=term-missing --cov-report=html:../coverage/backend --cov-report=json:../coverage/backend/coverage.json

frontend-test:
	cd frontend && npm run test:coverage

coverage-summary:
	@node scripts/coverage-summary.js

e2e-install:
	cd frontend/e2e && npm install && npx playwright install

e2e:
	cd frontend/e2e && npx playwright test

e2e-headed:
	cd frontend/e2e && npx playwright test --headed

e2e-report:
	cd frontend/e2e && npx playwright show-report ../../coverage/e2e

clean-coverage:
	-@powershell -NoProfile -Command "Remove-Item -Recurse -Force -ErrorAction SilentlyContinue coverage, backend/.coverage, backend/htmlcov, frontend/coverage"

up:
	docker compose up -d

down:
	docker compose down

build:
	docker compose up -d --build

logs:
	docker compose logs -f

ps:
	docker compose ps

backend-shell:
	docker compose exec backend sh

frontend-shell:
	docker compose exec frontend sh

clean:
	docker compose down --volumes --remove-orphans
