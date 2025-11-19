import cssContent from '../styles/base.css?inline';

export function injectStyles(customClass = '') {
    const styleId = 'cvp-base-styles';
    if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = cssContent;
        document.head.appendChild(style);
    }
}
