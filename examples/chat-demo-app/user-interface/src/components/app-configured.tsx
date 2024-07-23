import { useEffect, useState } from "react";
import {
  Alert,
  Authenticator,
  Heading,
  ThemeProvider,
  defaultDarkModeOverride,
  useTheme,
} from "@aws-amplify/ui-react";
import { StorageHelper } from "../common/helpers/storage-helper";
import { Mode } from "@cloudscape-design/global-styles";
import { StatusIndicator } from "@cloudscape-design/components";
import { APP_NAME } from "../common/constants";
import { Amplify, ResourcesConfig } from "aws-amplify";
import App from "../app";
import "@aws-amplify/ui-react/styles.css";

export default function AppConfigured() {
  const { tokens } = useTheme();
  const [config, setConfig] = useState<ResourcesConfig | null>(null);
  const [error, setError] = useState<boolean | null>(null);
  const [theme, setTheme] = useState(StorageHelper.getTheme());

  useEffect(() => {
    (async () => {
      try {
        const result = await fetch("/aws-exports.json");
        const awsExports: ResourcesConfig = await result.json();

        Amplify.configure(awsExports);

        setConfig(awsExports);
      } catch (e) {
        console.error(e);
        setError(true);
      }
    })();
  }, []);

  useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (
          mutation.type === "attributes" &&
          mutation.attributeName === "style"
        ) {
          const newValue =
            document.documentElement.style.getPropertyValue(
              "--app-color-scheme"
            );

          const mode = newValue === "dark" ? Mode.Dark : Mode.Light;
          if (mode !== theme) {
            setTheme(mode);
          }
        }
      });
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["style"],
    });

    return () => {
      observer.disconnect();
    };
  }, [theme]);

  if (!config) {
    if (error) {
      return (
        <div
          style={{
            height: "100%",
            width: "100%",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Alert heading="Configuration error" variation="error">
            Error loading configuration from "
            <a href="/aws-exports.json" style={{ fontWeight: "600" }}>
              /aws-exports.json
            </a>
            "
          </Alert>
        </div>
      );
    }

    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <StatusIndicator type="loading">Loading</StatusIndicator>
      </div>
    );
  }

  return (
    <ThemeProvider
      theme={{
        name: "default-theme",
        overrides: [defaultDarkModeOverride],
      }}
      colorMode={theme === Mode.Dark ? "dark" : "light"}
    >
      <Authenticator
        hideSignUp={true}
        components={{
          SignIn: {
            Header: () => {
              return (
                <Heading
                  padding={`${tokens.space.xl} 0 0 ${tokens.space.xl}`}
                  level={3}
                >
                  {APP_NAME}
                </Heading>
              );
            },
          },
        }}
      >
        <App />
      </Authenticator>
    </ThemeProvider>
  );
}
