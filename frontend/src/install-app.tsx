import {useEffect,useState} from "react";

interface InstallPromptEvent extends Event{prompt():Promise<void>;userChoice:Promise<{outcome:"accepted"|"dismissed"}>}

export function InstallApp(){
  const standalone=()=>typeof window!=="undefined"&&(matchMedia("(display-mode: standalone)").matches||(navigator as Navigator&{standalone?:boolean}).standalone===true);
  const[prompt,setPrompt]=useState<InstallPromptEvent|null>(null),[ios]=useState(()=>typeof navigator!=="undefined"&&/iphone|ipad|ipod/i.test(navigator.userAgent)&&!standalone()),[installed,setInstalled]=useState(standalone);
  useEffect(()=>{
    const ready=(event:Event)=>{event.preventDefault();setPrompt(event as InstallPromptEvent)};
    const done=()=>{setInstalled(true);setPrompt(null)};
    addEventListener("beforeinstallprompt",ready);addEventListener("appinstalled",done);
    return()=>{removeEventListener("beforeinstallprompt",ready);removeEventListener("appinstalled",done)};
  },[]);
  if(installed||(!prompt&&!ios))return null;
  if(ios)return <p className="install-hint">Install app: tap Share, then <strong>Add to Home Screen</strong>.</p>;
  return <button type="button" className="btn btn-secondary btn-lg" onClick={async()=>{await prompt!.prompt();if((await prompt!.userChoice).outcome==="accepted")setInstalled(true);setPrompt(null)}}>Install App</button>;
}

