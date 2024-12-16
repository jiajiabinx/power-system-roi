.PHONY: install
install:
	npm install
	cd frontend && npm install
	cd backend && poetry install

.PHONY: dev
dev:
	npm run dev

.PHONY: format-backend
format-backend:
	cd backend && poetry run black .

.PHONY: lint-backend
lint-backend:
	cd backend && poetry run flake8

.PHONY: test-backend
test-backend:
	cd backend && poetry run pytest 