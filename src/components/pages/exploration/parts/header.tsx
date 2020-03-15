import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { ExplorationType, ParameterKey, ParameterType, IntraDayDataSourceType, getIntraDayDataSourceName, inferIntraDayDataSourceType, inferDataSource } from "../../../../core/exploration/types";
import { SafeAreaView, View, Text, StyleSheet, TextStyle, ViewStyle, LayoutAnimation, ViewProps } from 'react-native';
import { CategoricalRow, CategoricalRowProps } from '../../../exploration/CategoricalRow';
import { DataSourceIcon } from '../../../common/DataSourceIcon';
import { ExplorationProps } from '../ExplorationScreen';
import { DateRangeBar, DateBar } from '../../../exploration/DateRangeBar';
import { explorationInfoHelper } from '../../../../core/exploration/ExplorationInfoHelper';
import { Button } from 'react-native-elements';
import { Sizes } from '../../../../style/Sizes';
import { StyleTemplates } from '../../../../style/Styles';
import { DataSourceManager } from '../../../../system/DataSourceManager';
import { DataSourceType } from '../../../../measure/DataSourceSpec';
import { createSetRangeAction, setDataSourceAction, InteractionType, goBackAction, setDateAction, setIntraDayDataSourceAction, setCycleTypeAction, setCycleDimensionAction } from '../../../../state/exploration/interaction/actions';
import Colors from '../../../../style/Colors';
import { useDispatch, useSelector } from 'react-redux';
import { ReduxAppState } from '../../../../state/types';
import { CyclicTimeFrame, cyclicTimeFrameSpecs, CycleDimension, getFilteredCycleDimensionList, getHomogeneousCycleDimensionList, getCycleDimensionSpec } from '../../../../core/exploration/cyclic_time';
import { SvgIcon, SvgIconType } from '../../../common/svg/SvgIcon';
import { makeNewSessionId, startSpeechSession, requestStopDictation } from '../../../../state/speech/commands';
import { createSetShowGlobalPopupAction } from '../../../../state/speech/actions';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../../Routes';
import { SpeechContextHelper } from '../../../../core/speech/nlp/context';

const titleBarOptionButtonIconInfo = <SvgIcon type={SvgIconType.Settings} size={22} color={'white'} />

const styles = StyleSheet.create({
    titleBarStyle: {
        paddingLeft: Sizes.horizontalPadding,
        paddingRight: Sizes.horizontalPadding,
        flexDirection: 'row',
        height: 50,
        alignItems: 'center',
    },
    titleBarTitleStyle: {
        ...StyleTemplates.headerTitleStyle,
        flex: 1
    },

    titleBarButtonContainerStyle: {
        marginLeft: 8
    },

    titleBarButtonStyle: {
        backgroundColor: '#ffffff64',
        width: 28,
        height: 28,
        borderRadius: 14,
        margin: 0
    }
})

const backButtonProps = {
    icon: <SvgIcon color={Colors.headerBackgroundDarker} size={18} type={SvgIconType.ArrowLeft} />,
    containerStyle: {
        marginTop: 8,
        marginBottom: 8,
        alignSelf: 'flex-start',
        marginLeft: Sizes.horizontalPadding - 4
    } as ViewStyle,
    buttonStyle: {
        paddingTop: 0,
        paddingBottom: 0,
        paddingLeft: 2,
        paddingRight: 12,
        borderRadius: 50,
        backgroundColor: '#FFFFFFdd'
    },

    hitSlop: {
        top: 10,
        bottom: 10
    },

    titleStyle: {
        color: Colors.headerBackground,
        fontSize: Sizes.tinyFontSize,
        fontWeight: 'bold'
    } as TextStyle
} as ViewProps

export const ExplorationViewHeader = () => {

    const explorationType = useSelector((appState: ReduxAppState) => appState.explorationState.info.type)

    useEffect(() => {
        LayoutAnimation.configureNext(
            LayoutAnimation.create(
                500, LayoutAnimation.Types.easeInEaseOut, "opacity")
        )
    }, [explorationType])

    const navigation = useNavigation<StackNavigationProp<RootStackParamList, "Exploration">>()

    switch (explorationType) {
        case ExplorationType.B_Overview:
            return <HeaderContainer>
                <View style={styles.titleBarStyle}>
                    <Text style={styles.titleBarTitleStyle}>Browse</Text>
                    <Button
                        buttonStyle={styles.titleBarButtonStyle}
                        containerStyle={styles.titleBarButtonContainerStyle}
                        icon={titleBarOptionButtonIconInfo}
                        onPress={() => {
                            navigation.navigate("Settings")
                        }} />
                </View>
                <HeaderRangeBar />
            </HeaderContainer>
        case ExplorationType.B_Range:
            return <HeaderContainer>
                <DataSourceBar showBorder={false} />
                <HeaderRangeBar />
            </HeaderContainer>
        case ExplorationType.B_Day:
            return <HeaderContainer>
                <IntraDayDataSourceBar showBorder={true} />
                <HeaderDateBar />

            </HeaderContainer>
        case ExplorationType.C_Cyclic:
            return <HeaderContainer>
                <DataSourceBar showBorder={true} />
                <CyclicComparisonTypeBar showBorder={false} />
                <HeaderRangeBar />
            </HeaderContainer>
        case ExplorationType.C_CyclicDetail_Daily:
        case ExplorationType.C_CyclicDetail_Range:
            return <HeaderContainer>
                <DataSourceBar showBorder={true} />
                <CycleDimensionBar showBorder={false} />
                <HeaderRangeBar />
            </HeaderContainer>
        case ExplorationType.C_TwoRanges:
            return <HeaderContainer>
                <DataSourceBar showBorder={false} />
                <HeaderRangeBar showBorder={true} parameterKey={ParameterKey.RangeA} />
                <HeaderRangeBar parameterKey={ParameterKey.RangeB} />
            </HeaderContainer>
    }
}

const HeaderContainer = (prop: { children?: any, }) => {

    const dispatch = useDispatch()
    const {
        backStackSize,
        backTitle
    } = useSelector((appState: ReduxAppState) => {
        const backStackSize = appState.explorationState.backNavStack.length
        return {
            backStackSize,
            backTitle: backStackSize > 0 ? (explorationInfoHelper.getTitleText(appState.explorationState.backNavStack[backStackSize-1])) : null
        }
    })

    return <SafeAreaView>
        {backStackSize > 0 &&
            <Button title={backTitle || "Back"}
                {...backButtonProps}
                onPress={() => {
                    dispatch(goBackAction())
                }}
            />
        }
        {prop.children}
    </SafeAreaView>
}

const HeaderRangeBar = React.memo((props: { parameterKey?: ParameterKey, showBorder?: boolean }) => {

    const explorationInfo = useSelector((appState: ReduxAppState) => appState.explorationState.info)
    const dispatch = useDispatch()
    const [speechSessionId, setSpeechSessionId] = useState<string | null>(null)

    const range = explorationInfoHelper.getParameterValue<[number, number]>(explorationInfo, ParameterType.Range, props.parameterKey)!

    const onRangeChanged = useCallback((from, to, xType) => {
        dispatch(createSetRangeAction(xType, [from, to], props.parameterKey))
    }, [dispatch, props.parameterKey])

    const onLongPressIn = useCallback((position) => {
        const sessionId = makeNewSessionId()
        setSpeechSessionId(sessionId)
        dispatch(startSpeechSession(sessionId, SpeechContextHelper.makeTimeSpeechContext(position, props.parameterKey)))
        dispatch(createSetShowGlobalPopupAction(true, sessionId))
    }, [dispatch, setSpeechSessionId, props.parameterKey])

    const onLongPressOut = useCallback((position) => {
        if (speechSessionId != null) {
            console.log("request stop dictation")
            dispatch(requestStopDictation(speechSessionId))
            dispatch(createSetShowGlobalPopupAction(false, speechSessionId))
        }
        setSpeechSessionId(null)
    }, [dispatch, speechSessionId, setSpeechSessionId])

    return <DateRangeBar from={range && range[0]} to={range && range[1]}
        onRangeChanged={onRangeChanged}
        onLongPressIn={onLongPressIn}
        onLongPressOut={onLongPressOut}
        showBorder={props.showBorder} />
})

const HeaderDateBar = React.memo(() => {
    const [speechSessionId, setSpeechSessionId] = useState<string | null>(null)
    const explorationInfo = useSelector((appState: ReduxAppState) => appState.explorationState.info)
    const dispatch = useDispatch()
    const date = explorationInfoHelper.getParameterValue<number>(explorationInfo, ParameterType.Date)!

    const onDateChanged = useCallback((date: number, interactionType: InteractionType) => {
        dispatch(setDateAction(interactionType, date))
    }, [dispatch])

    const onLongPressIn = useCallback(() => {
        const newSessionId = makeNewSessionId()
        dispatch(createSetShowGlobalPopupAction(true, newSessionId))
        dispatch(startSpeechSession(newSessionId, SpeechContextHelper.makeTimeSpeechContext('date')))
        setSpeechSessionId(newSessionId)
    }, [dispatch, setSpeechSessionId])

    const onLongPressOut = useCallback(() => {
        if (speechSessionId != null) {
            dispatch(createSetShowGlobalPopupAction(false, speechSessionId))
            dispatch(requestStopDictation(speechSessionId))
        }
        setSpeechSessionId(null)
    }, [speechSessionId, setSpeechSessionId, dispatch])

    return <DateBar date={date}
        onDateChanged={onDateChanged}
        onLongPressIn={onLongPressIn}
        onLongPressOut={onLongPressOut}
    />
})

interface SpeechSupportedCategoricalRowProps extends CategoricalRowProps {
    parameterType: ParameterType
}

const SpeechSupportedCategoricalRow = (props: SpeechSupportedCategoricalRowProps) => {
    const dispatch = useDispatch()

    const [speechSessionId, setSpeechSessionId] = useState<string | null>(null)
    const onLongPressIn = useCallback(() => {
        const newSessionId = makeNewSessionId()
        dispatch(createSetShowGlobalPopupAction(true, newSessionId))
        dispatch(startSpeechSession(newSessionId, SpeechContextHelper.makeCategoricalRowElementSpeechContext(props.parameterType as any)))
        setSpeechSessionId(newSessionId)
    }, [dispatch, setSpeechSessionId])

    const onLongPressOut = useCallback(() => {
        if (speechSessionId != null) {
            dispatch(createSetShowGlobalPopupAction(false, speechSessionId))
            dispatch(requestStopDictation(speechSessionId))
        }
        setSpeechSessionId(null)
    }, [speechSessionId, setSpeechSessionId, dispatch])

    return <CategoricalRow {...props} onLongPressIn={onLongPressIn} onLongPressOut={onLongPressOut} />
}

const DataSourceBar = React.memo((props: { showBorder: boolean }) => {
    const dispatch = useDispatch()
    const explorationInfo = useSelector((appState: ReduxAppState) => appState.explorationState.info)
    const sourceType = explorationInfoHelper.getParameterValue(explorationInfo, ParameterType.DataSource) as DataSourceType
    const sourceSpec = DataSourceManager.instance.getSpec(sourceType)

    const iconProps = useCallback((index) => {
        return {
            type: DataSourceManager.instance.supportedDataSources[index].type,
        }
    }, [])

    const values = useMemo(() => DataSourceManager.instance.supportedDataSources.map(spec => spec.name), [])

    return <SpeechSupportedCategoricalRow parameterType={ParameterType.DataSource} title="Data Source" showBorder={props.showBorder} value={sourceSpec.name}
        IconComponent={DataSourceIcon}
        iconProps={iconProps}
        values={values}
        onValueChange={(newValue, newIndex) =>
            dispatch(setDataSourceAction(InteractionType.TouchOnly, DataSourceManager.instance.supportedDataSources[newIndex].type))
        }
    />
})

const IntraDayDataSourceBar = React.memo((props: { showBorder: boolean }) => {
    const dispatch = useDispatch()
    const explorationInfo = useSelector((appState: ReduxAppState) => appState.explorationState.info)

    const intraDaySourceType = explorationInfoHelper.getParameterValue<IntraDayDataSourceType>(explorationInfo, ParameterType.IntraDayDataSource)!
    const sourceTypeName = getIntraDayDataSourceName(intraDaySourceType)

    const supportedIntraDayDataSourceTypes = useMemo(() => {
        const result: Array<IntraDayDataSourceType> = []
        DataSourceManager.instance.supportedDataSources.forEach(s => {
            const inferred = inferIntraDayDataSourceType(s.type)
            if (result.indexOf(inferred) === -1 && inferred != null) {
                result.push(inferred)
            }
        })
        return result
    }, [])

    const values = useMemo(() => supportedIntraDayDataSourceTypes.map(type => getIntraDayDataSourceName(type)),
        [supportedIntraDayDataSourceTypes])


    return <SpeechSupportedCategoricalRow parameterType={ParameterType.IntraDayDataSource} title="Data Source" showBorder={false} value={sourceTypeName}
        IconComponent={DataSourceIcon}
        iconProps={(index) => {
            return {
                type: inferDataSource(supportedIntraDayDataSourceTypes[index])
            }
        }}
        values={values}
        onValueChange={(value, index) => {
            dispatch(setIntraDayDataSourceAction(InteractionType.TouchOnly, supportedIntraDayDataSourceTypes[index]))
        }}
    />
})

const CyclicComparisonTypeBar = (props: { showBorder: boolean }) => {
    const dispatch = useDispatch()
    const explorationInfo = useSelector((appState: ReduxAppState) => appState.explorationState.info)
    const cycleType = explorationInfoHelper.getParameterValue<CyclicTimeFrame>(explorationInfo, ParameterType.CycleType)!
    const cycles = useMemo(() => Object.keys(cyclicTimeFrameSpecs), [])

    return <SpeechSupportedCategoricalRow parameterType={ParameterType.CycleType} title="Group By" showBorder={props.showBorder} value={cyclicTimeFrameSpecs[cycleType].name}
        values={cycles.map(key => cyclicTimeFrameSpecs[key].name)}
        onValueChange={(value, index) => {
            dispatch(setCycleTypeAction(InteractionType.TouchOnly, cycles[index] as any))
        }}
    />
}

const CycleDimensionBar = (props: { showBorder: boolean }) => {
    const dispatch = useDispatch()
    const explorationInfo = useSelector((appState: ReduxAppState) => appState.explorationState.info)
    const cycleDimension = explorationInfoHelper.getParameterValue<CycleDimension>(explorationInfo, ParameterType.CycleDimension)!
    const spec = useMemo(() => getCycleDimensionSpec(cycleDimension), [cycleDimension])
    const selectableDimensions = useMemo(() => getHomogeneousCycleDimensionList(cycleDimension), [cycleDimension])
    const dimensionNames = useMemo(() => selectableDimensions.map(spec => spec.name), [selectableDimensions])

    return <SpeechSupportedCategoricalRow parameterType={ParameterType.CycleDimension} title="Cycle Filter" showBorder={props.showBorder} value={spec.name}
        values={dimensionNames}
        onValueChange={(value, index) => {
            dispatch(setCycleDimensionAction(InteractionType.TouchOnly, selectableDimensions[index].dimension))
        }}
    />
}