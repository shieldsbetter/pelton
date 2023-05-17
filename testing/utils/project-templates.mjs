const templates = {
    basic(name, envs) {
        return JSON.stringify({
            dnsName: name,
            environments: Object.fromEntries(
                Object.entries(envs).map(([envName, envSpec]) => [
                    envName,
                    {
                        build: `echo BUILD ${name} BUILD`,
                        printProjectManifest: `echo "
                            apiVersion: v1
                            kind: ConfigMap
                            metadata:
                              name: ${name}-$PELTON_ENVIRONMENT-$PELTON_ISOLATION-cm
                            data:
                              peltonBres: \"($PELTON_BUILD_RESULT)\"
                        "`,
                        dependencies: envSpec.map(([dir, env, iso]) => ({
                            printProjectDirectory: `echo ${dir}`,

                            ...(env ? { environment: env } : undefined),
                            ...(iso ? { isolation: iso } : undefined)
                        }))
                    }
                ]))
        }, null, 4);
    }
};

export default templates;
