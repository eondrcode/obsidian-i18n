/**
 * [模块] 账户与登录 (Account)
 */
export default {
    Titles: {
        Tab: "登录/注册",
        Welcome: "欢迎",
        WelcomeBack: "欢迎回来"
    },
    Labels: {
        AccountStatus: "账户状态",
        ConnectedCloud: "已连接云端",
        RememberMe: "记住账号密码",
        Username: "用户名",
        Password: "密码",
        Email: "邮箱",
        Code: "验证码",
        ConfirmPassword: "确认密码",
        DefaultUser: "用户",
        UserId: "用户 ID"
    },
    Actions: {
        Login: "登录",
        Logout: "退出登录",
        Register: "注册",
        SendCode: "发送验证码",
        CreateAccount: "创建账户"
    },
    Status: {
        LoggingIn: "登录中...",
        Registering: "注册中..."
    },
    Hints: {
        LoginDesc: "登录您的账户以访问云端功能",
        RegisterDesc: "注册新账户以开始使用"
    },
    Notices: {
        SendSuccess: "发送成功",
        RegSuccess: "注册成功，请登录",
        LoggedOut: "已退出登录"
    },
    Errors: {
        SendFail: "发送失败",
        LoginFail: "登录失败",
        RegFail: "注册失败",
        PassMismatch: "两次密码不一致",
        NoEmail: "未设置邮箱",
        InputEmail: "请输入邮箱",
        InputUserPass: "请输入用户名和密码",
        InputEmailCode: "请输入邮箱和验证码"
    }
} as const;
