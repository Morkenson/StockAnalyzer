.PHONY: help test coverage backend-test backend-coverage frontend-test clean-coverage

help:
	@echo "Available targets:"
	@echo "  make test              Run all configured tests"
	@echo "  make coverage          Run all configured tests with coverage scores"
	@echo "  make backend-test      Run backend pytest suite"
	@echo "  make backend-coverage  Run backend pytest suite with coverage"
	@echo "  make frontend-test     Report frontend test status"
	@echo "  make clean-coverage    Remove generated coverage output"

test: backend-test frontend-test

coverage: backend-coverage frontend-test

backend-test:
	cd backend && python -m pytest

backend-coverage:
	cd backend && python -m pytest --cov=. --cov-config=.coveragerc --cov-report=term-missing --cov-report=html:../coverage/backend

frontend-test:
	@echo "Frontend tests are not configured yet: no Angular test target/spec suite exists to produce a coverage score."

clean-coverage:
	-@powershell -NoProfile -Command "Remove-Item -Recurse -Force -ErrorAction SilentlyContinue coverage, backend/.coverage, backend/htmlcov, frontend/coverage"
