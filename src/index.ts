import liferay from "./liferay";

const virtualInstances = ["example.liferay.com"];

for (const virtualInstance of virtualInstances) {
    const response = await liferay.post(
        `o/headless-portal-instances/v1.0/portal-instances`,
        {
            json: {
                admin: {
                    familyName: "Leone",
                    givenName: "Keven",
                    emailAddress: "keven.leone@liferay.com",
                },
                domain: "lxc.app",
                portalInstanceId: virtualInstance,
                siteInitializerKey: "com.liferay.site.initializer.welcome",
                virtualHost: virtualInstance,
            },
            timeout: 240 * 1000,
        }
    );

    const data = response.json();

    console.log("Virtual Instance created", data);
}
