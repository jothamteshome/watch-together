/**
 * Renders a user icon.
 */
export default function UserIcon({ src }: { src: string}) {
    return (
        <div className="aspect-square max-h-10">
            <img className="rounded-full" src={src} />
        </div>
    );
}