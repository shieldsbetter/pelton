const templates = {
    basic(name, envs) {
        return JSON.stringify({
            dnsName: name,
            environments: Object.fromEntries(
                Object.entries(envs).map(([envName, envSpec]) => [
                    envName,
                    {
                        buildCommand: `echo BUILD ${name} BUILD`,
                        printTerminalDependencies: `echo "
                            apiVersion: v1
                            kind: ConfigMap
                            metadata:
                              name: ${name}-$PELTON_ENVIRONMENT-$PELTON_ISOLATION-cm
                            data:
                              foo: bar
                        "`,
                        peltonDependencies: envSpec.map(([dir, env, iso]) => ({
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
