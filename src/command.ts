import { App } from "obsidian";
import I18N from "./main";
import { MANAGER_VIEW_TYPE } from "./views/manager/manager-view";
import { t } from "./locales";

const commands = (app: App, i18n: I18N) => {
    i18n.addCommand({
        id: 'i18n-translate',
        name: t('command.open_panel'),
        callback: () => { i18n.view.activateView(MANAGER_VIEW_TYPE) }
    });
}

export default commands