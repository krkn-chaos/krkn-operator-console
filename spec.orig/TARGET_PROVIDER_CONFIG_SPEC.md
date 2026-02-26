# API spec
check TARGET_PROVIDER_CONFIG_API.md
# description
I want to add a tab in the config section of the console per each KrknOperatorTargetProvider contained in the KrknOperatorTargetProviderConfig config-data section (the provider name is the key of the object).
if the value of the object is empty the tab can be omitted
The first item in the tab page must be an activate/deactivate toggle that must effectively query the relative service to activate and deactivate the provider. If active a form based on the schema contained in the CR must be presented, default values must be set accordingly with the default field in the schema. Would be awesome if the same form generation logic can be reused from the ChaosScenario form generation since the typing system is exactly the same. When submitted this will update the configuration of the respective operator using POST /provider-config/{uuid} - Update provider config.
In order to retrieve the schema a POST must be done to POST /provider-config - Create config request, this will return a UUID and the status of the object must be polled through GET /provider-config/{uuid} - Get config status, until the data is returned.