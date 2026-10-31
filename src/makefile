install:
	cd web && npm install
build:
	cd web && npm run build
sync:
	cd web && npx cap sync android
sync-ios:
	cd web && npx cap sync ios
build-sync:install build sync
build-sync-ios:install build sync-ios
build-start:install build
	cd web && npm run start
