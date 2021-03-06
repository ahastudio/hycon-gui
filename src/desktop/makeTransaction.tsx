import * as utils from "@glosfer/hyconjs-util"
import { CircularProgress, Dialog, DialogTitle, FormControl, Input, InputLabel, Select } from "@material-ui/core"
import Button from "@material-ui/core/Button"
import CardContent from "@material-ui/core/CardContent"
import Grid from "@material-ui/core/Grid"
import Icon from "@material-ui/core/Icon"
import { Card, MenuItem, TextField } from "material-ui"
import * as React from "react"
import update = require("react-addons-update")
import { Redirect } from "react-router"
import { IText } from "../locales/locales"
import { IHyconWallet, IRest, IWalletAddress } from "../rest"
import { AddressBook } from "./addressBook"
import { MultipleAccountsView } from "./multipleAccountsView"
interface IMakeTransactionProps {
    rest: IRest
    language: IText
    walletType?: string
    address?: string
    name?: string
    selectedAccount?: string
    nonce?: number
}
export class MakeTransaction extends React.Component<IMakeTransactionProps, any> {
    public mounted = false
    public mapWallets: Map<string, IHyconWallet>

    constructor(props: IMakeTransactionProps) {
        super(props)

        this.state = {
            address: "",
            amount: 0,
            cancelRedirect: false,
            dialog: false,
            favorites: [],
            fromAddress: props.address ? props.address : "",
            initialSelected: props.selectedAccount,
            isLoading: false,
            isMultiple: true,
            minerFee: 1,
            name: props.name ? props.name : "",
            nonce: props.nonce,
            password: "",
            pendingAmount: "0",
            piggyBank: "0",
            remain_attemp: "",
            rest: props.rest,
            selectedAccount: props.selectedAccount,
            txStep: false,
            walletType: props.walletType,
            wallets: [],
        }
        this.handleInputChange = this.handleInputChange.bind(this)
        this.handleSubmit = this.handleSubmit.bind(this)
        this.handleCancel = this.handleCancel.bind(this)
        this.prevPage = this.prevPage.bind(this)
        this.mapWallets = new Map<string, IHyconWallet>()
    }
    public componentWillUnmount() {
        this.mounted = false
    }
    public componentDidMount() {
        this.mounted = true
        this.state.rest.setLoading(true)
        this.getFavorite()
        this.getTOTP()
        if (this.state.walletType === "ledger") {
            if (this.state.selectedAccount === undefined) { return }
            this.state.rest.getLedgerWallet(Number(this.state.selectedAccount), 1).then((result: IHyconWallet[] | number) => {
                if (this.mounted) {
                    if (typeof (result) !== "number") {
                        this.setState({
                            fromAddress: result[0].address,
                            name: "ledgerWallet",
                            pendingAmount: result[0].pendingAmount,
                            piggyBank: result[0].balance,
                            txStep: true,
                        })
                    } else {
                        alert(`Please check connection and launch Hycon app.`)
                        this.setState({ cancelRedirect: true })
                    }
                }
                this.state.rest.setLoading(false)
            })
        }
        if (this.state.walletType === "local") {
            this.state.rest.getWalletList().then((data: { walletList: IHyconWallet[], length: number }) => {
                const walletPromises = data.walletList.map((wallet) => {
                    if (wallet.address && wallet.address !== "") {
                        return new Promise((resolve, _) => {
                            this.state.rest.getAddressInfo(wallet.address).then((account: any) => {
                                resolve({ name: wallet.name, address: wallet.address, balance: account.balance, pendingAmount: account.pendingAmount })
                            })
                        })
                    } else {
                        return new Promise((resolve, _) => {
                            resolve({ name: "", address: "", balance: "0.0", pendingAmount: "0.0" })
                        })
                    }
                })

                Promise.all(walletPromises).then((walletList: IHyconWallet[]) => {
                    for (const wallet of walletList) {
                        if (wallet.name !== "") {
                            this.mapWallets.set(wallet.address, wallet)
                            this.setState({ wallets: update(this.state.wallets, { $push: [wallet] }) })
                        }
                    }
                    if (this.mounted) {
                        this.setState({ txStep: true })
                    }
                    this.state.rest.setLoading(false)
                })
            })
        }
        if (this.state.walletType === "hdwallet") {
            if (this.state.fromAddress === "") { alert(`Error`); this.setState({ cancelRedirect: true }) }
            this.state.rest.getAddressInfo(this.state.fromAddress).then((result: IWalletAddress) => {
                if (this.mounted) {
                    this.setState({ pendingAmount: result.pendingAmount, piggyBank: result.balance, txStep: true })
                }
                this.state.rest.setLoading(false)
            })
        }
        if (this.state.walletType === "bitbox") {
            if (this.state.fromAddress === "") { return }
            this.state.rest.getAddressInfo(this.state.fromAddress).then((result: IWalletAddress) => {
                if (this.mounted) {
                    this.setState({ name: "bitboxWallet", fromAddress: this.state.fromAddress, pendingAmount: result.pendingAmount, piggyBank: result.balance, txStep: true })
                }
                this.state.rest.setLoading(false)
            })
        }
    }

    public handlePassword(data: any) {
        this.setState({ password: data.target.value })
    }

    public handleInputChange(event: any) {
        const name = event.target.name
        const value = event.target.value
        if (name === "fromAddress") {
            const wallet = this.mapWallets.get(value)
            this.setState({ name: wallet.name, fromAddress: value, piggyBank: wallet.balance, pendingAmount: wallet.pendingAmount })
        } else {
            this.setState({ [name]: value })
        }
    }

    public checkInputs() {
        const pattern1 = /(^[0-9]*)([.]{0,1}[0-9]{0,9})$/
        if (this.state.amount <= 0) {
            alert(`${this.props.language["alert-enter-valid-amount"]}`)
            return
        }
        if (this.state.amount.match(pattern1) == null) {
            alert(`${this.props.language["alert-decimal-overflow"]}`)
            return
        }
        if (this.state.nonce === undefined && utils.hyconfromString(this.state.amount).add(utils.hyconfromString(this.state.minerFee)).greaterThan(utils.hyconfromString(this.state.piggyBank).sub(utils.hyconfromString(this.state.pendingAmount)))) {
            alert(`${this.props.language["alert-insufficient-funds"]}`)
            return
        }
        if (utils.hyconfromString(this.state.minerFee).compare(utils.hyconfromString("0")) === 0) {
            alert(`${this.props.language["alert-miner-fee"]}`)
            return
        }
        if (this.state.fromAddress === this.state.address) {
            alert(`${this.props.language["alert-cannot-send-self"]}`)
            return
        }
        if (this.state.address === "" || this.state.address === undefined) {
            alert(`${this.props.language["alert-address-empty"]}`)
            return
        }
        if (this.state.name === "" || this.state.fromAddress === "") {
            alert(`${this.props.language["alert-invalid-from-addr"]}`)
            return
        }
        return true
    }

    public async handleSubmit(event: any) {
        if (this.state.totp) {
            const res = await this.state.rest.verifyTOTP(this.state.totpToken, this.state.totpPw)
            if (!res) { alert(this.props.language["alert-invalid-code-password"]); return }
        }

        this.setState({ isLoading: true })

        if (this.state.walletType === "ledger") {
            if (!confirm(this.props.language["guide-sign-ledger"])) {
                this.setState({ isLoading: false })
                return
            }
            this.state.rest.sendTxWithLedger(Number(this.state.selectedAccount), this.state.fromAddress, this.state.address, this.state.amount.toString(), this.state.minerFee.toString(), this.state.nonce).then((result: { res: boolean, case: number }) => {
                this.alertResult(result)
            })
        }
        if (this.state.walletType === "local") {
            const namecheck = this.mapWallets.get(this.state.fromAddress)
            if (this.state.name !== namecheck.name) {
                alert(`${this.props.language["alert-try-again"]}`)
                return
            }
            this.state.rest.sendTx({ name: this.state.name, password: this.state.password, address: this.state.address, amount: this.state.amount.toString(), minerFee: this.state.minerFee.toString() })
                .then((result: { res: boolean, case?: number }) => {
                    this.alertResult(result)
                })
        }
        if (this.state.walletType === "hdwallet") {
            this.state.rest.sendTxWithHDWallet({ name: this.state.name, password: this.state.password, address: this.state.address, amount: this.state.amount.toString(), minerFee: this.state.minerFee.toString(), nonce: this.state.nonce }, Number(this.state.selectedAccount))
                .then((result: { res: boolean, case?: number }) => {
                    this.alertResult(result)
                })
        }
        if (this.state.walletType === "bitbox") {
            this.state.rest.sendTxWithBitbox({ from: this.state.fromAddress, password: this.state.password, address: this.state.address, amount: this.state.amount.toString(), minerFee: this.state.minerFee.toString(), nonce: this.state.nonce }, Number(this.state.selectedAccount))
                .then((result: { res: boolean, case?: (number | { error: number, remain_attemp: string }) }) => {
                    if (typeof (result.case) === "number") {
                        this.alertResult({ res: result.res, case: result.case })
                    } else if (!result.res) {
                        this.setState({ remain_attemp: result.case.remain_attemp })
                        this.alertResult({ res: result.res, case: result.case.error })
                    } else {
                        this.alertResult({ res: result.res })
                    }
                })
        }
        event.preventDefault()
    }
    public handleCancel() {
        if (this.state.initialSelected !== undefined && this.state.initialSelected !== "") {
            this.setState({ redirect: true })
        } else {
            this.setState({ cancelRedirect: true })
        }
    }

    public selectedAccountFunction(selectedAccount: string, account: IHyconWallet) {
        this.setState({
            fromAddress: account.address,
            name: "ledgerWallet",
            pendingAmount: account.pendingAmount,
            piggyBank: account.balance,
            selectedAccount,
            txStep: true,
        })
    }

    public render() {
        let walletIndex = 0
        if (this.state.redirect) {
            if (this.state.walletType === "local" || this.state.walletType === "hdwallet") {
                return <Redirect to={`/wallet/detail/${this.state.name}`} />
            } else {
                return <Redirect to={`/address/${this.state.fromAddress}/${this.state.walletType}/${this.state.selectedAccount}`} />
            }
        }
        if (this.state.cancelRedirect) {
            return <Redirect to={`/wallet`} />
        }
        return (
            <div style={{ width: "80%", margin: "auto" }}>
                <Card>
                    <h3 style={{ color: "grey", textAlign: "center" }}><Icon style={{ transform: "rotate(-25deg)", marginRight: "10px", color: "grey" }}>send</Icon>{this.props.language["send-transaction"]}</h3><br />
                    {this.state.txStep ?
                        <CardContent>
                            <div style={{ textAlign: "center" }}>
                                <Grid container direction={"row"} justify={"flex-end"} alignItems={"flex-end"}>
                                    <Button variant="raised" onClick={() => { this.setState({ dialog: true }) }} style={{ backgroundColor: "#f2d260", color: "white", float: "right", margin: "0 10px" }}>
                                        <Icon>bookmark</Icon><span style={{ marginLeft: "5px" }}>{this.props.language["address-book"]}</span>
                                    </Button>
                                </Grid>
                                {(this.state.walletType === "local")
                                    ? (<FormControl style={{ width: "330px", marginTop: "1.5%" }}>
                                        <InputLabel style={{ top: "19px", transform: "scale(0.75) translate(0px, -28px)", color: "rgba(0, 0, 0, 0.3)", fontSize: "16px" }} htmlFor="fromAddress">{this.props.language["from-address"]}</InputLabel>
                                        <Select value={this.state.fromAddress} onChange={this.handleInputChange} input={<Input name="fromAddress" />}>
                                            {this.state.wallets.map((wallet: IHyconWallet) => {
                                                return (<MenuItem key={walletIndex++} value={wallet.address}>{wallet.address}</MenuItem>)
                                            })}
                                        </Select>
                                    </FormControl>)
                                    : (<TextField style={{ width: "330px" }} floatingLabelFixed={true} floatingLabelText={this.props.language["from-address"]} type="text" disabled={true} value={this.state.fromAddress} />)
                                }
                                <TextField name="address" floatingLabelFixed={true} style={{ marginLeft: "30px", width: "330px" }} floatingLabelText={this.props.language["to-address"]} type="text" value={this.state.address} onChange={this.handleInputChange} />
                                <br />
                                <TextField style={{ width: "330px" }} floatingLabelFixed={true} floatingLabelText={this.props.language["wallet-balance"]} type="text" disabled={true} value={this.state.piggyBank} />
                                <TextField style={{ marginLeft: "30px", width: "330px" }} name="amount" floatingLabelFixed={true} floatingLabelText={this.props.language["total-amount"]} type="text" value={this.state.amount} max={this.state.piggyBank} onChange={this.handleInputChange} />
                                <br />
                                <TextField floatingLabelText={this.props.language["wallet-pending"]} floatingLabelFixed={true} style={{ width: "330px" }} type="text" disabled={true} value={this.state.pendingAmount} />
                                <TextField name="minerFee" floatingLabelFixed={true} style={{ marginLeft: "30px", width: "330px" }} floatingLabelText={this.props.language.fees} type="text" value={this.state.minerFee} onChange={this.handleInputChange} />
                                <br />
                                <TextField name="password" value={this.state.password} floatingLabelFixed={true} style={{ margin: "auto", width: "330px", display: `${this.state.walletType === "ledger" ? "none" : "block"}` }} floatingLabelText={this.props.language.password} type="password" autoComplete="off" onChange={(data) => { this.handlePassword(data) }} />
                                <br /><br />
                                <Grid container direction={"row"} justify={"center"} alignItems={"center"}>
                                    {(this.state.walletType !== "local" && (this.state.initialSelected === undefined || this.state.initialSelected === "") ?
                                        (<Button onClick={this.prevPage}>{this.props.language["button-previous"]}</Button>)
                                        : (<Button onClick={this.handleCancel}>{this.props.language["button-cancel"]}</Button>))}
                                    {this.state.totp
                                        ? (<Button onClick={() => { if (this.checkInputs()) { this.setState({ dialogTOTP: true }) } }}>{this.props.language.totp}</Button>)
                                        : (<Button onClick={(event) => { if (this.checkInputs()) { this.handleSubmit(event) } }}>{this.props.language["button-transfer"]}</Button>)
                                    }
                                </Grid>
                            </div>
                        </CardContent>
                        :
                        <CardContent>
                            <MultipleAccountsView selectFunction={(index: string, account: IHyconWallet) => { this.selectedAccountFunction(index, account) }} rest={this.state.rest} selectedAccount={this.state.selectedAccount} walletType={this.state.walletType} />
                        </CardContent>
                    }
                </Card >

                {/* ADDRESS BOOK */}
                <Dialog open={this.state.dialog} onClose={() => { this.setState({ dialog: false }) }}>
                    <AddressBook rest={this.state.rest} favorites={this.state.favorites} language={this.props.language} isWalletView={false} callback={(address: string) => { this.handleListItemClick(address) }} />
                </Dialog>

                {/* LOADING */}
                <Dialog open={this.state.isLoading} aria-labelledby="alert-dialog-title" aria-describedby="alert-dialog-description" >
                    <div style={{ textAlign: "center", margin: "1em" }}>
                        <CircularProgress style={{ marginRight: "5px" }} size={50} thickness={2} />
                    </div>
                </Dialog>

                {/* GOOGLE TRANSACTION OTP */}
                <Dialog style={{ textAlign: "center" }} open={this.state.dialogTOTP} onClose={() => { this.setState({ dialogTOTP: false }) }}>
                    <DialogTitle id="simple-dialog-title">{this.props.language.totp}</DialogTitle>
                    <div style={{ margin: "2em" }}>
                        <p>{this.props.language["transaction-totp"]}</p>
                        <TextField floatingLabelText={this.props.language["totp-google-code"]} autoComplete="off"
                            errorText={this.state.errorText} errorStyle={{ float: "left" }}
                            value={this.state.totpToken}
                            onChange={(data) => { this.handleTOTP(data) }} /><br />
                        <TextField floatingLabelText={this.props.language["totp-otp-password"]} type="password" autoComplete="off"
                            value={this.state.totpPw}
                            onChange={(data) => { this.handleTOTPpassword(data) }} /><br /><br />
                        <Grid container direction={"row"} justify={"center"} alignItems={"center"}>
                            <Button variant="raised" onClick={() => { this.setState({ dialogTOTP: false }) }} style={{ backgroundColor: "rgb(225, 0, 80)", color: "white" }}>{this.props.language["button-cancel"]}</Button>
                            <Button variant="raised" onClick={this.handleSubmit} style={{ backgroundColor: "#50aaff", color: "white", margin: "0 10px" }}>{this.props.language["button-transfer"]}</Button>
                        </Grid>
                    </div>
                </Dialog>
            </div >
        )
    }
    private handleListItemClick(toAddr: string) {
        this.setState({ address: toAddr, dialog: false })
    }

    private getFavorite() {
        this.state.rest.getFavoriteList()
            .then((data: Array<{ alias: string, address: string }>) => {
                if (this.mounted) { this.setState({ favorites: data }) }
            })
    }

    private alertResult(result: { res: boolean, case?: number }) {
        if (result.res === true) {
            alert(`${this.props.language["alert-send-success"]}\n- ${this.props.language["send-amount"]}: ${this.state.amount}\n- ${this.props.language.fees}: ${this.state.minerFee}\n- ${this.props.language["to-address"]}: ${this.state.address}`)
            this.setState({ redirect: true })
            return
        }
        this.setState({ isLoading: false })
        switch (result.case) {
            case 1:
                if (this.state.walletType === "ledger") {
                    alert(`${this.props.language["alert-invalid-address-from"]}`)
                } else {
                    this.setState({ password: "" })
                    alert(`${this.props.language["alert-invalid-password"]}`)
                }
                break
            case 2:
                alert(`${this.props.language["alert-invalid-address-to"]}`)
                break
            case 3:
                alert(`${this.props.language["alert-send-failed"]}`)
                this.setState({ redirect: true })
                break
            case 4:
                alert(`${this.props.language["alert-ledger-sign-failed"]}`)
                break
            case 20:
                alert(`Can not find bitbox device.`)
                break
            case 21:
                alert(`Password information was not found.`)
                this.setState({ redirect: true })
                break
            case 22:
                alert(`Wallet information was not found.`)
                this.setState({ redirect: true })
                break
            case 23:
                if (this.state.remain_attemp !== "") {
                    alert(`Invalid password. Please try again. ${this.state.remain_attemp} attempts remain before the device is reset.`)
                } else {
                    alert(`Invalid password. Please try again.`)
                }
                this.setState({ password: "" })
                break
            case 26:
                alert(`Your Bitbox Wallet has been reset. Please make new wallet.`)
                this.setState({ redirect: true })
                break
            case 27:
                alert(`Invalid from address. Please try again.`)
                break
            case 28:
                alert(`Failed to sign with bitbox wallet. Please try again.`)
                break
            case 29:
                alert(`Due to many login attempts, the next login requires holding the touch button for 3 seconds. If the LED light is displayed on the bitbox, touch it for 3 seconds.`)
                break
            case 30:
                alert(`Failed to get accounts from bitbox wallet. Please check connection and try again.`)
                break
            case 32:
                alert(`Failed to check that wallet information is set.`)
                break
            default:
                alert("Failed to transfer hycon")
                this.setState({ redirect: true })
                break
        }
    }

    private prevPage() {
        this.setState({
            address: "",
            amount: 0,
            fromAddress: "",
            minerFee: 1,
            pendingAmount: "0",
            piggyBank: "0",
            selectedAccount: "",
            txStep: false,
        })
    }

    private getTOTP() {
        this.state.rest.getTOTP().then((result: boolean) => {
            if (result) {
                this.setState({ totp: true })
            } else {
                this.setState({ totp: false })
            }
        })
    }
    private handleTOTP(data: any) {
        const patternSixDigits = /^[0-9]{6}$/
        this.setState({ totpToken: data.target.value })
        if (!patternSixDigits.test(data.target.value)) {
            this.setState({ errorText: this.props.language["alert-six-digit"] })
        } else {
            this.setState({ errorText: "" })
        }
    }
    private handleTOTPpassword(data: any) {
        this.setState({ totpPw: data.target.value })
    }
}
