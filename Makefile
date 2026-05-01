.PHONY: help test coverage backend-test backend-coverage frontend-test coverage-summary clean-coverage

help:
	@echo "Available targets:"
	@echo "  make test              Run all configured tests"
	@echo "  make coverage          Run all configured tests with coverage scores"
	@echo "  make backend-test      Run backend pytest suite"
	@echo "  make backend-coverage  Run backend pytest suite with coverage"
	@echo "  make frontend-test     Run frontend Jest suite with coverage"
	@echo "  make clean-coverage    Remove generated coverage output"

test: coverage

coverage: backend-coverage frontend-test coverage-summary

backend-test:
	cd backend && python -m pytest

backend-coverage:
	cd backend && python -m pytest --cov=. --cov-config=.coveragerc --cov-report=term-missing --cov-report=html:../coverage/backend --cov-report=json:../coverage/backend/coverage.json

frontend-test:
	cd frontend && npm run test:coverage

coverage-summary:
	@node scripts/coverage-summary.js

clean-coverage:
	-@powershell -NoProfile -Command "Remove-Item -Recurse -Force -ErrorAction SilentlyContinue coverage, backend/.coverage, backend/htmlcov, frontend/coverage"
