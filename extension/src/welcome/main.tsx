/** Welcome page shown once after installing. Nothing here is required. */
import { render } from "preact";
import { bootPage } from "../ui/boot";
import { Welcome } from "./Welcome";

bootPage(() => render(<Welcome />, document.getElementById("app")!));
