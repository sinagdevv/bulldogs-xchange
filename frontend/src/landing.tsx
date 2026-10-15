import {NavLink} from "react-router-dom";
import {Icon} from "./icons";
import {InstallApp} from "./install-app";
import {useReveal} from "./motion";
import {AccessoriesCabinet,ApparelRack,ShowroomHero} from "./showroom";
import {journey} from "./content";

export function Landing(){
  useReveal();
  return <>
    <ShowroomHero/>
    <ApparelRack/>
    <AccessoriesCabinet/>
    <section className="sr-sec sr-path" aria-labelledby="path-title"><div className="container">
      <div className="sr-head" data-reveal><div><span className="eyebrow">From discovery to pickup</span><h2 id="path-title" className="display sm">Six steps to your merch.</h2></div><NavLink className="text-link" to="/how-it-works">See the full journey<Icon name="arrow"/></NavLink></div>
      <ol className="sr-path-line" data-reveal>{journey.map(([t],i)=><li key={t}><span className="n">{String(i+1).padStart(2,"0")}</span><span>{t}</span></li>)}</ol>
    </div></section>
    <section className="cta-band lp-cta"><div className="cta-bg" aria-hidden="true"><span className="hb-ring"/></div><div className="container inner" data-reveal><div><h2 className="display on-dark">Your campus style starts here.</h2><p>Exclusively for NU Fairview students and authorized personnel.</p></div><div className="row"><NavLink className="btn btn-gold btn-lg" to="/catalog">Explore merchandise<Icon name="arrow"/></NavLink><InstallApp/></div></div></section>
  </>;
}
