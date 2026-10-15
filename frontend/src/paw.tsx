/** Decorative bulldog paw. Always aria-hidden; colour comes from currentColor. */
export function Paw({className=""}:{className?:string}){
  return <svg className={`paw ${className}`.trim()} viewBox="0 0 64 64" aria-hidden="true" focusable="false"><g fill="currentColor"><ellipse cx="32" cy="43" rx="15" ry="11.5"/><ellipse cx="13" cy="27" rx="6" ry="8" transform="rotate(-20 13 27)"/><ellipse cx="25" cy="15" rx="6" ry="8.6" transform="rotate(-7 25 15)"/><ellipse cx="39" cy="15" rx="6" ry="8.6" transform="rotate(7 39 15)"/><ellipse cx="51" cy="27" rx="6" ry="8" transform="rotate(20 51 27)"/></g></svg>;
}
