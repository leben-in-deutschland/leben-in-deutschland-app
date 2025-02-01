import { statesData } from "@/data/data";
import { getUserData } from "@/services/user";
import { State } from "@/types/state";
import { User } from "@/types/user";
import { Avatar, Select, SelectItem, Image } from "@heroui/react";
import { useEffect, useState } from "react";

export default function StateDropdown({ user, handleSelectState }: { user: User | undefined, handleSelectState: any }) {
    const [states, setStates] = useState<State[]>([]);
    useEffect(() => {
        let states = statesData();
        setStates(states);
    }, []);
    const handleSelectionChange = (e: any) => {
        let index = states.findIndex(x => x.name === e.target.value);
        if (index > -1) {
            handleSelectState(states[index]);
        }
    };

    return (
        <>
            {user && states && states.length > 0 && <Select
                label="Select state"
                startContent={<Image alt={user?.state.stateName} src={user ? `/states/flag/${user?.state.stateName}.svg` : "/states/deutschland.jpg"} width={20} />}
                defaultSelectedKeys={[user ? user.state.stateName : "Berlin"]}
                onChange={handleSelectionChange}
            >
                {
                    states.map((state: State) => (
                        <SelectItem
                            key={state.name}
                            className="dark:text-white"
                            startContent={< Avatar alt={state.name} className="w-5 h-5" src={`/states/flag/${state.name}.svg`} />}
                        >
                            {state.name}
                        </SelectItem>
                    ))
                }

            </Select >
            }
        </>
    );
};