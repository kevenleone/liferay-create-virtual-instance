import ky from "ky";
import z from "zod";

import Cache from "./cache";

export const liferayAuthSchema = z.object({
    LIFERAY_CLIENT_ID: z.string().optional(),
    LIFERAY_CLIENT_SECRET: z.string().optional(),
    LIFERAY_HOST: z.string(),
    LIFERAY_PASSWORD: z.string().optional(),
    LIFERAY_USERNAME: z.string().optional(),
});

const {
    LIFERAY_HOST,
    LIFERAY_CLIENT_ID,
    LIFERAY_CLIENT_SECRET,
    LIFERAY_PASSWORD,
    LIFERAY_USERNAME,
} = liferayAuthSchema.parse(Bun.env);

const isBasicAuth = LIFERAY_USERNAME && LIFERAY_PASSWORD;

const liferay = ky.extend({
    prefixUrl: LIFERAY_HOST,
});

const cache = Cache.getInstance();

export default liferay.extend({
    headers: {
        Authorization: isBasicAuth
            ? `Basic ${btoa(`${LIFERAY_USERNAME}:${LIFERAY_PASSWORD}`)}`
            : "",
    },
    hooks: {
        beforeRequest: [
            (request) => {
                const authorization = cache.get("authorization");

                if (authorization) {
                    request.headers.set("authorization", authorization);
                }
            },
        ],
        beforeRetry: [
            async ({ request, error, retryCount }) => {
                const authorization = request.headers.get("authorization");

                if (authorization) {
                    console.log({
                        request,
                        retryCount,
                        error,
                    });
                }

                if (
                    isBasicAuth ||
                    !LIFERAY_CLIENT_ID ||
                    !LIFERAY_CLIENT_SECRET
                ) {
                    return;
                }

                const isExpired = cache.has("expires_in")
                    ? Date.now() > cache.get("expires_in")
                    : false;

                if (!request.headers.get("authorization") || isExpired) {
                    const searchParams = new URLSearchParams();

                    searchParams.set("client_id", LIFERAY_CLIENT_ID);
                    searchParams.set("client_secret", LIFERAY_CLIENT_SECRET);
                    searchParams.set("grant_type", "client_credentials");

                    const response = await liferay.post("o/oauth2/token", {
                        body: searchParams,
                    });

                    console.log(`${LIFERAY_HOST} Token exchanged`);

                    const data = await response.json<any>();

                    const authorization = `${data.token_type} ${data.access_token}`;

                    cache.set(
                        "expires_in",
                        data.expires_in * 1000 + Date.now() - 15000
                    );
                    cache.set("authorization", authorization);

                    return request.headers.set("authorization", authorization);
                }
            },
        ],
    },
    retry: {
        limit: 5,
        methods: ["get", "post"],
        statusCodes: [403, 401],
        delay: (attemptCount) => 5000 * attemptCount,
    },
});
