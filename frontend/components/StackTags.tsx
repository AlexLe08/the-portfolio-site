// A project's stack as technical-identifier tags. The wrapper class sets
// the layout, which differs between the project list and a project page.
export function StackTags({ stack, className }: { stack: string[]; className: string }) {
  return (
    <div className={className}>
      {stack.map((tech) => (
        <span className="tag" key={tech}>
          {tech}
        </span>
      ))}
    </div>
  );
}
