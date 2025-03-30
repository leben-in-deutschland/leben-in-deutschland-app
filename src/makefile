install:
	cd web && npm install
build:
	cd web && npm run build
sync:
	cd web && npx cap sync android
build-sync:install build sync
build-start:install build
	cd web && npm run start