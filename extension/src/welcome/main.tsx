/** Welcome page shown once after installing. Nothing here is required. */
import { render } from "preact";
import { Welcome } from "./Welcome";

render(<Welcome />, document.getElementById("app")!);
