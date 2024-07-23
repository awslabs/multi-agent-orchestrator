import { Popover } from "@cloudscape-design/components";
import styles from "../../styles/chat-ui.module.scss";
import { ReactElement } from "react";

export function Avatar(props: {
  readonly name?: string;
  readonly content?: ReactElement;
  readonly role: "ai" | "human";
  readonly waiting?: boolean;
}) {
  return (
    <div
      style={{
        display: "block",
        marginRight: "1em",
        width: "40px",
        height: "40px",
        minWidth: "40px",
        minHeight: "40px",
        alignContent: "start",
        borderRadius: "50%",
        background:
          props.role === "ai"
            ? "linear-gradient(300deg, rgb(52,20,120), rgb(118,72,250), rgb(62,141,255))"
            : "#545b64",
      }}
    >
      {props.waiting ? (
        <div className={styles.wave}>
          <span className={styles.dot}></span>
          <span className={styles.dot}></span>
          <span className={styles.dot}></span>
        </div>
      ) : (
        <>
          <div
            style={{
              display: "block",
              textAlign: "center",
              position: "relative",
              color: "#FFFFFF",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
            }}
          >
            {props.content ? (
              <div
                style={{
                  width: "25px",
                  height: "25px",
                  color: "#FFFFFF",
                  margin: "auto",
                }}
              >
                {props.content}
              </div>
            ) : (
              <Popover
                content={props.name}
                dismissButton={false}
                position="top"
                size="small"
              >
                <h3>{(props.name ?? "A")[0].toUpperCase()}</h3>
              </Popover>
            )}
          </div>
        </>
      )}
    </div>
  );
}
