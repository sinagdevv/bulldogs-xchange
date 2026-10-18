import {NavLink} from "react-router-dom";
import {Icon} from "./icons";
import {InstallApp} from "./install-app";
import {useReveal} from "./motion";

export function Landing(){
  useReveal();
  return <>
    <section className="cta-band lp-cta"><div className="cta-bg" aria-hidden="true"><span className="hb-ring"/></div><div className="container inner" data-reveal><div><span className="eyebrow on-dark">Bulldogs Xchange</span><h1 className="display on-dark">Campus merchandise, ready for pickup.</h1><p>Browse the official catalog and reserve available items for collection at NU Fairview.</p></div><div className="row"><NavLink className="btn btn-gold btn-lg" to="/catalog">Browse catalog<Icon name="arrow"/></NavLink><InstallApp/></div></div></section>
  </>;
}
