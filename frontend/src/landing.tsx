import {NavLink} from "react-router-dom";
import {Icon} from "./icons";
import {InstallApp} from "./install-app";
import {useReveal} from "./motion";
import {AccessoriesCabinet,ApparelRack,ShowroomHero} from "./showroom";

export function Landing(){
  useReveal();
  return <>
    <ShowroomHero/>
    <ApparelRack/>
    <AccessoriesCabinet/>
    <section className="cta-band lp-cta"><div className="cta-bg" aria-hidden="true"><span className="hb-ring"/></div><div className="container inner" data-reveal><div><h2 className="display on-dark">Your campus style starts here.</h2><p>Exclusively for NU Fairview students and authorized personnel.</p></div><div className="row"><NavLink className="btn btn-gold btn-lg" to="/catalog">Explore merchandise<Icon name="arrow"/></NavLink><InstallApp/></div></div></section>
  </>;
}
