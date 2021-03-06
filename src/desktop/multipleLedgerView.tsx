import { Button, Radio } from "@material-ui/core"
import Grid from "@material-ui/core/Grid"
import { CircularProgress } from "material-ui"
import * as React from "react"
import update = require("react-addons-update")
import { Redirect } from "react-router"
import { IHyconWallet } from "../rest"

export class MultipleLedgerView extends React.Component<any, any> {
    public mounted = false

    constructor(props: any) {
        super(props)

        this.state = {
            initialSelectedLedger: props.selectedLedger,
            isLedgerPossibility: props.isLedgerPossibility,
            isLoad: false,
            ledgerAccounts: [],
            ledgerStartIndex: 0,
            moreLoading: false,
            redirect: false,
            rest: props.rest,
            selectFunction: props.selectFunction,
            selectedLedger: "",
        }
        this.handleInputChange = this.handleInputChange.bind(this)
        this.handleCancel = this.handleCancel.bind(this)
        this.getLedgerAccounts = this.getLedgerAccounts.bind(this)
    }
    public componentWillUnmount() {
        this.mounted = false
    }
    public componentDidMount() {
        this.mounted = true
        if (this.state.isLedgerPossibility === true || this.state.isLedgerPossibility === "true") {
            if (this.state.initialSelectedLedger === undefined || this.state.initialSelectedLedger === "") {
                this.getLedgerAccounts()
            }
        }
    }

    public handleInputChange(event: any) {
        const name = event.target.name
        const value = event.target.value
        this.setState({ [name]: value })
    }

    public handleCancel() {
        this.setState({ redirect: true })
    }
    public render() {
        if (this.state.redirect) {
            return <Redirect to={`/wallet`} />
        }
        if (!this.state.isLoad) {
            return (
                <div style={{ textAlign: "center" }}>
                    <CircularProgress style={{ marginRight: "5px" }} size={50} thickness={2} /> LOADING
                </div>
            )
        }
        return (
            <div style={{ textAlign: "center" }}>
                <div style={{ overflow: "scroll", height: "19em", margin: "1%" }}>
                    <table className="mdl-data-table mdl-js-data-table mdl-shadow--2dp" style={{ width: "100%", border: "0" }}>
                        <thead>
                            <tr>
                                <th className="mdl-data-table__cell--non-numeric"> </th>
                                <th className="mdl-data-table__cell--non-numeric">{this.props.language["wallet-address"]}</th>
                                <th className="mdl-data-table__cell--numeric" style={{ paddingRight: "10%" }}>{this.props.language["wallet-balance"]}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {this.state.ledgerAccounts.map((account: IHyconWallet, idx: number) => {
                                return (
                                    <tr key={idx}>
                                        <td className="mdl-data-table__cell--non-numeric" style={{ padding: "0 0 0 0" }}>
                                            <Radio
                                                checked={this.state.selectedLedger === String(idx)}
                                                onChange={this.handleInputChange}
                                                value={String(idx)}
                                                name="selectedLedger"
                                            />
                                        </td>
                                        <td className="mdl-data-table__cell--non-numeric">{account.address}</td>
                                        <td className="mdl-data-table__cell--numeric" style={{ paddingRight: "10%" }}>{account.balance} HYCON</td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
                <Grid container direction={"row"} justify={"flex-end"} alignItems={"flex-end"} style={{ marginTop: "1%" }}>
                    <Button variant="outlined" style={{ display: `${this.state.moreLoading ? ("none") : ("block")}`, width: "100%" }} onClick={this.getLedgerAccounts}>{this.props.language["load-more"]}</Button>
                    <Button variant="outlined" style={{ display: `${this.state.moreLoading ? ("block") : ("none")}`, width: "100%" }} onClick={this.getLedgerAccounts} disabled ><CircularProgress size={15} /> {this.props.language["load-more"]}</Button>
                </Grid>
                <Grid container direction={"row"} justify={"center"} alignItems={"center"} style={{ marginTop: "1%" }}>
                    <Button onClick={this.handleCancel}>{this.props.language["button-cancel"]}</Button>
                    <Button onClick={() => { this.selectFunction() }}>{this.props.language["button-next"]}</Button>
                </Grid>
            </div>
        )
    }

    private getLedgerAccounts() {
        this.setState({ moreLoading: true })
        this.state.rest.getLedgerWallet(this.state.ledgerStartIndex, 10).then((result: IHyconWallet[] | number) => {
            if (this.mounted) {
                if (typeof (result) !== "number") {
                    this.setState({ isLoad: true, ledgerStartIndex: this.state.ledgerStartIndex + result.length })
                    this.setState({ ledgerAccounts: update(this.state.ledgerAccounts, { $push: result }) })
                } else {
                    alert(`${this.props.language["alert-ledger-connect-failed"]}`)
                    this.setState({ isLoad: true, redirect: true })
                    window.location.reload()
                }
            }
            this.setState({ moreLoading: false })
            this.state.rest.setLoading(false)
        })
    }

    private selectFunction() {
        if (this.state.selectedLedger === "") {
            alert(`${this.props.language["alert-select-account"]}`)
            return
        }
        this.state.selectFunction(this.state.selectedLedger, this.state.ledgerAccounts[Number(this.state.selectedLedger)])
    }
}
